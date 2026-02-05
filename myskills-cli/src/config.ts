import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load .env from the package root (for development mostly)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const GITEA_BASE_URL = 'https://gitea.server10086.icu/';
export const GITEA_OWNER = 'admin';
export const GITEA_REPO = 'claudeskill';
export const GITEA_ROOT_PATH = 'skills';

export const getGiteaToken = (): string | undefined => {
  return process.env.GITEA_TOKEN;
};
