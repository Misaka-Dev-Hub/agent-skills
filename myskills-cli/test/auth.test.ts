import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getGiteaToken, setGiteaToken, clearGiteaToken } from '../src/config.js';
import { loginCommand } from '../src/commands/login.js';
import { logoutCommand } from '../src/commands/logout.js';
import { GiteaClient } from '../src/api.js';

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
const promptMock = vi.fn();
vi.mock('inquirer', () => ({
  default: {
    prompt: (args: any) => promptMock(args),
  },
}));

// Mock API Client
vi.mock('../src/api.js', () => {
    return {
        GiteaClient: vi.fn().mockImplementation(() => ({
            listSkills: vi.fn(),
        })),
    }
});

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


// Mock Console
const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('EXIT'); }) as any);


describe('Authentication Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GITEA_TOKEN;
    for (const key in mockConfig) delete mockConfig[key];
    spinnerMock.text = '';
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
    it('should save token if verification succeeds', async () => {
        // Mock prompt to return token
        promptMock.mockResolvedValueOnce({ token: 'valid-token' });

        // Mock API success
        const mockListSkills = vi.fn().mockResolvedValue(['skill1']);
        (GiteaClient as any).mockImplementation(() => ({
            listSkills: mockListSkills
        }));

        await loginCommand();

        expect(spinnerMock.start).toHaveBeenCalled();
        expect(mockListSkills).toHaveBeenCalled();
        expect(mockConfig['gitea_token']).toBe('valid-token');
        expect(spinnerMock.succeed).toHaveBeenCalledWith(expect.stringContaining('登录成功'));
    });

    it('should not save token if verification fails and user exits', async () => {
        // 1. Enter token
        promptMock.mockResolvedValueOnce({ token: 'invalid-token' });

        // Mock API failure
        const mockListSkills = vi.fn().mockRejectedValue(new Error('Auth Failed'));
        (GiteaClient as any).mockImplementation(() => ({
            listSkills: mockListSkills
        }));

        // 2. Choose to exit
        promptMock.mockResolvedValueOnce({ action: 'exit' });

        try {
            await loginCommand();
        } catch (e: any) {
            expect(e.message).toBe('EXIT');
        }

        expect(mockListSkills).toHaveBeenCalled();
        expect(mockConfig['gitea_token']).toBeUndefined();
        expect(spinnerMock.fail).toHaveBeenCalledWith(expect.stringContaining('Authentication failed'));
    });

    it('should retry if verification fails and user chooses retry', async () => {
         // 1. Enter invalid token
         promptMock.mockResolvedValueOnce({ token: 'invalid-token' });

         // Mock API failure first time
         const mockListSkills = vi.fn()
            .mockRejectedValueOnce(new Error('Auth Failed'))
            .mockResolvedValueOnce(['skill1']); // Success second time

         (GiteaClient as any).mockImplementation(() => ({
             listSkills: mockListSkills
         }));

         // 2. Choose to retry
         promptMock.mockResolvedValueOnce({ action: 'retry' });

         // 3. Enter valid token
         promptMock.mockResolvedValueOnce({ token: 'valid-token' });

         await loginCommand();

         expect(mockListSkills).toHaveBeenCalledTimes(2);
         expect(mockConfig['gitea_token']).toBe('valid-token');
         expect(spinnerMock.succeed).toHaveBeenCalledWith(expect.stringContaining('登录成功'));
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
