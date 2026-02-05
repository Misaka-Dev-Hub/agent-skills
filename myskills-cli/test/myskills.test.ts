import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import fs from 'fs';
import { GiteaClient } from '../src/api.js';
import { listCommand } from '../src/commands/list.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

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
const spinnerMock = {
    start: vi.fn().mockReturnThis(),
    stopAndPersist: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
};
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
});
