import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { GiteaClient } from '../src/api.js';
import { listCommand } from '../src/commands/list.js';
import { addCommand } from '../src/commands/add.js';
import { outdatedCommand } from '../src/commands/outdated.js';
import { upgradeCommand } from '../src/commands/upgrade.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import path from 'path';

// Hoist fs mocks
const fsMocks = vi.hoisted(() => ({
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    readFileSync: vi.fn(),
    renameSync: vi.fn(),
    rmSync: vi.fn(),
}));

vi.mock('fs', async () => {
    const actual = await vi.importActual<any>('fs');
    return {
        ...actual,
        default: {
            ...actual,
            ...fsMocks,
        },
        ...fsMocks,
    };
});

// Mock axios
const mockGet = vi.fn();
vi.mock('axios', () => ({
    default: {
        create: vi.fn(() => ({
            get: mockGet,
        })),
    },
}));

// Mock config
vi.mock('../src/config.js', () => ({
    GITEA_BASE_URL: 'http://mock-url',
    GITEA_OWNER: 'owner',
    GITEA_REPO: 'repo',
    GITEA_ROOT_PATH: 'skills',
    getGiteaToken: vi.fn(() => 'mock-token'),
}));

// Mock inquirer
const promptMock = vi.fn();
vi.mock('inquirer', () => ({
    default: {
        prompt: (args: any) => promptMock(args),
    }
}));

// Mock ora
const spinnerMock = vi.hoisted(() => ({
    start: vi.fn().mockReturnThis(),
    stopAndPersist: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
}));

vi.mock('ora', () => ({
    default: vi.fn(() => spinnerMock),
}));


// Spy on console
const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

// Spy on process.exit
const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('EXIT'); }) as any);

describe('MySkills CLI Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGet.mockReset();
        spinnerMock.text = '';
        fsMocks.existsSync.mockReturnValue(false);
        fsMocks.readdirSync.mockReturnValue([]);
        fsMocks.statSync.mockReturnValue({ isDirectory: () => true });
    });

    describe('GiteaClient', () => {
        it('listSkills returns directories', async () => {
            mockGet.mockResolvedValue({
                data: [
                    { name: 'skill1', type: 'dir' },
                    { name: 'skill2', type: 'dir' },
                    { name: 'file1', type: 'file' },
                ]
            });
            const client = new GiteaClient();
            const result = await client.listSkills();
            expect(result).toEqual(['skill1', 'skill2']);
        });

        it('getLatestCommitSha returns sha', async () => {
            mockGet.mockResolvedValue({
                data: [{ sha: 'abc1234' }]
            });
            const client = new GiteaClient();
            const result = await client.getLatestCommitSha('some/path');
            expect(result).toBe('abc1234');
        });

        it('downloadSkill recurses correctly', async () => {
            const client = new GiteaClient();

            // Mock API responses for recursion
            mockGet.mockImplementation((url) => {
                if (url.includes('skills/recursive-skill/subdir')) {
                    // Subdir level - Check this FIRST
                    return Promise.resolve({
                        data: [
                            { name: 'sub.txt', type: 'file', download_url: 'http://dl/sub.txt' }
                        ]
                    });
                } else if (url.includes('contents/skills/recursive-skill')) {
                    // Root level
                    return Promise.resolve({
                        data: [
                            { name: 'root.txt', type: 'file', download_url: 'http://dl/root.txt' },
                            { name: 'subdir', type: 'dir', path: 'skills/recursive-skill/subdir' }
                        ]
                    });
                } else if (url === 'http://dl/root.txt' || url === 'http://dl/sub.txt') {
                    return Promise.resolve({ data: Buffer.from('content') });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });

            const onProgress = vi.fn();
            await client.downloadSkill('recursive-skill', '/tmp/dest', onProgress);

            expect(fsMocks.mkdirSync).toHaveBeenCalledWith('/tmp/dest', { recursive: true });
            expect(fsMocks.mkdirSync).toHaveBeenCalledWith(path.join('/tmp/dest', 'subdir'), { recursive: true });
            expect(fsMocks.writeFileSync).toHaveBeenCalledTimes(2);
            expect(onProgress).toHaveBeenCalledWith('root.txt');
            expect(onProgress).toHaveBeenCalledWith('sub.txt');
        });
    });

    describe('addCommand', () => {
        it('single mode: downloads skill and writes metadata', async () => {
            mockGet.mockImplementation((url) => {
                 // Mock SHA fetch
                 if (url.includes('/commits')) {
                     return Promise.resolve({ data: [{ sha: 'commit-sha' }] });
                 }
                 // Mock root listing
                 if (url.includes('contents/skills/skill1')) {
                     return Promise.resolve({
                        data: [{ name: 'file1.txt', type: 'file', download_url: 'http://dl/file1.txt' }]
                     });
                 }
                 // Mock file download
                 if (url === 'http://dl/file1.txt') {
                     return Promise.resolve({ data: Buffer.from('content') });
                 }
                 return Promise.reject(new Error(`Unknown URL: ${url}`));
            });

            await addCommand('skill1');

            expect(spinnerMock.start).toHaveBeenCalled();
            expect(spinnerMock.succeed).toHaveBeenCalled();

            // Verify metadata write
            expect(fsMocks.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('.myskills.meta.json'),
                expect.stringContaining('commit-sha')
            );
        });
    });

    describe('outdatedCommand', () => {
        it('identifies outdated skills', async () => {
            // Setup fs mocks for skills dir
            fsMocks.existsSync.mockReturnValue(true); // .claude/skills exists
            fsMocks.readdirSync.mockReturnValue(['skill1']); // one skill installed

            // Mock local metadata
            fsMocks.readFileSync.mockReturnValue(JSON.stringify({
                name: 'skill1',
                remote_path: 'skills/skill1',
                commit_sha: 'old_sha'
            }));

            // Mock remote SHA
            mockGet.mockImplementation((url) => {
                 if (url.includes('/commits')) {
                     return Promise.resolve({ data: [{ sha: 'new_sha' }] });
                 }
                 return Promise.resolve({ data: [] });
            });

            await outdatedCommand();

            // Expect log output to contain "Update available" - wait, logSpy captures console.log
            // outdatedCommand uses cli-table3 which uses console.log(table.toString())
            // We check if logSpy was called with something containing 'Update available'

            // Note: Table output might contain ansi codes.
            // Check if any call matches
            const calls = logSpy.mock.calls.map(c => c[0]);
            const output = calls.join('\n');
            expect(output).toContain('Update available');
            expect(output).toContain('skill1');
        });
    });

    describe('upgradeCommand', () => {
        it('upgrades an outdated skill', async () => {
             // 1. Setup mocks
             fsMocks.existsSync.mockReturnValue(true);

             // Meta read
             fsMocks.readFileSync.mockReturnValue(JSON.stringify({
                name: 'skill1',
                remote_path: 'skills/skill1',
                commit_sha: 'old_sha'
            }));

            // Remote SHA check
             mockGet.mockImplementation((url) => {
                 if (url.includes('/commits')) {
                     return Promise.resolve({ data: [{ sha: 'new_sha' }] });
                 }
                 // Download calls
                 if (url.includes('contents/skills/skill1')) {
                      return Promise.resolve({ data: [{ name: 'file1.txt', type: 'file', download_url: 'http://dl/file1.txt' }] });
                 }
                 if (url === 'http://dl/file1.txt') {
                      return Promise.resolve({ data: Buffer.from('new content') });
                 }
                 return Promise.reject(new Error(`Unknown URL: ${url}`));
            });

            // Readdir for verify
            fsMocks.readdirSync.mockReturnValue(['file1.txt']);

            await upgradeCommand('skill1');

            // Verify backup was made
            expect(fsMocks.renameSync).toHaveBeenCalled();
            // Verify install happened (write meta)
            expect(fsMocks.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('.myskills.meta.json'),
                expect.stringContaining('new_sha')
            );
            // Verify cleanup
            expect(fsMocks.rmSync).toHaveBeenCalledWith(expect.stringContaining('.bak'), expect.any(Object));
        });
    });
});
