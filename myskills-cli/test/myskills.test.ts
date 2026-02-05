import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import fs from 'fs';
import { GiteaClient } from '../src/api.js';
import { listCommand } from '../src/commands/list.js';
import inquirer from 'inquirer';

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

// Spy on console
const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

// Spy on process.exit
const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('EXIT'); }) as any);

describe('MySkills CLI Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGet.mockReset();
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
        it('displays skills', async () => {
            mockGet.mockResolvedValue({
                data: [
                    { name: 'skill1', type: 'dir' },
                ]
            });

            await listCommand();
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Available Skills'));
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('skill1'));
        });

        it('handles no skills', async () => {
             mockGet.mockResolvedValue({
                data: []
            });
            await listCommand();
             expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No skills found'));
        });

        it('handles error gracefully', async () => {
            mockGet.mockRejectedValue(new Error('Network Error'));
            try {
                await listCommand();
            } catch (e: any) {
                expect(e.message).toBe('EXIT');
            }
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Network Error'));
        });
    });
});
