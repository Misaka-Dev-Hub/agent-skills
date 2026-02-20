import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Conf from 'conf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load .env from the package root (for development mostly)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const GITEA_BASE_URL = 'https://gitea.server10086.icu/';
export const GITEA_OWNER = 'admin';
export const GITEA_REPO = 'claudeskill';
export const GITEA_ROOT_PATH = 'skills';

// Initialize configuration
const config = new Conf<{ gitea_token: string }>({ projectName: 'myskills' });

export const getGiteaToken = (): string | undefined => {
  // Priority 1: Environment Variable
  if (process.env.GITEA_TOKEN) {
    return process.env.GITEA_TOKEN;
  }
  // Priority 2: Persistent Config
  return config.get('gitea_token');
};

export const setGiteaToken = (token: string): void => {
  config.set('gitea_token', token);
};

export const clearGiteaToken = (): void => {
  config.delete('gitea_token');
};

export const getConfigPath = (): string => {
  return config.path;
};
