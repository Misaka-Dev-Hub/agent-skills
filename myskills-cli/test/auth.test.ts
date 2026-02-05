import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getGiteaToken, setGiteaToken, clearGiteaToken } from '../src/config.js';
import { loginCommand } from '../src/commands/login.js';
import { logoutCommand } from '../src/commands/logout.js';
import chalk from 'chalk';

// Mock Conf
const mockConfig: Record<string, any> = {};
vi.mock('conf', () => {
  return {
    default: class {
      get(key: string) {
        return mockConfig[key];
      }
      set(key: string, value: any) {
        mockConfig[key] = value;
      }
      delete(key: string) {
        delete mockConfig[key];
      }
      get path() {
        return '/mock/path';
      }
    }
  };
});

// Mock Inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn().mockResolvedValue({ token: 'mock-token-from-inquirer' }),
  },
}));

// Mock Console
const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('Authentication Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GITEA_TOKEN;
    for (const key in mockConfig) delete mockConfig[key];
  });

  describe('Token Priority', () => {
    it('should prefer environment variable over config', () => {
      process.env.GITEA_TOKEN = 'env-token';
      mockConfig['gitea_token'] = 'config-token';
      expect(getGiteaToken()).toBe('env-token');
    });

    it('should use config if env var is missing', () => {
      mockConfig['gitea_token'] = 'config-token';
      expect(getGiteaToken()).toBe('config-token');
    });

    it('should return undefined if both are missing', () => {
      expect(getGiteaToken()).toBeUndefined();
    });
  });

  describe('Login Command', () => {
    it('should save token to config', async () => {
      await loginCommand();
      expect(mockConfig['gitea_token']).toBe('mock-token-from-inquirer');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Login Successful'));
    });
  });

  describe('Logout Command', () => {
    it('should remove token from config', async () => {
      mockConfig['gitea_token'] = 'existing-token';
      await logoutCommand();
      expect(mockConfig['gitea_token']).toBeUndefined();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Logged out'));
    });
  });
});
