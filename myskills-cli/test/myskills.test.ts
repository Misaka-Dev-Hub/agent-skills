import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { GiteaClient } from '../src/api.js';
import { listCommand } from '../src/commands/list.js';
import { addCommand } from '../src/commands/add.js'; // Import addCommand
import inquirer from 'inquirer';
import chalk from 'chalk';
import path from 'path';

// Hoist fs mocks
const fsMocks = vi.hoisted(() => ({
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
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
vi.mock('inquirer', () => ({
    default: {
        prompt: vi.fn(),
    }
}));

// Mock ora
const spinnerMock = vi.hoisted(() => ({
    start: vi.fn().mockReturnThis(),
    stopAndPersist: vi.fn().mockReturnThis(),
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

        it('listSkills throws on 404', async () => {
             mockGet.mockRejectedValue({ response: { status: 404 } });
             const client = new GiteaClient();
             await expect(client.listSkills()).rejects.toThrow('Skills directory not found');
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

    describe('listCommand', () => {
        it('displays skills using spinner', async () => {
            mockGet.mockResolvedValue({
                data: [
                    { name: 'skill1', type: 'dir' },
                ]
            });

            await listCommand();

            expect(spinnerMock.start).toHaveBeenCalled();
            expect(spinnerMock.stopAndPersist).toHaveBeenCalledWith(expect.objectContaining({
                symbol: '📦',
                text: expect.stringContaining('成功获取以下 Skills')
            }));
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('skill1'));
        });

        it('handles no skills', async () => {
             mockGet.mockResolvedValue({
                data: []
            });
            await listCommand();
             expect(spinnerMock.stopAndPersist).toHaveBeenCalledWith(expect.objectContaining({
                 symbol: '⚠️',
                 text: expect.stringContaining('No skills found')
             }));
        });

        it('handles error gracefully with spinner fail', async () => {
            mockGet.mockRejectedValue(new Error('Network Error'));
            try {
                await listCommand();
            } catch (e: any) {
                expect(e.message).toBe('EXIT');
            }
            expect(spinnerMock.fail).toHaveBeenCalledWith(expect.stringContaining('Network Error'));
        });
    });

    describe('addCommand', () => {
        it('downloads skill with spinner updates', async () => {
            mockGet.mockImplementation((url) => {
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
        });
    });
});
