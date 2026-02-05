import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import path from 'path';
import { GITEA_BASE_URL, GITEA_OWNER, GITEA_REPO, GITEA_ROOT_PATH, getGiteaToken } from './config.js';

interface GiteaFile {
  name: string;
  path: string;
  sha: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  size: number;
  encoding?: string;
  content?: string;
  download_url?: string;
  url?: string;
  html_url?: string;
}

export type DownloadProgressCallback = (filePath: string) => void;

export class GiteaClient {
  private client: AxiosInstance;

  constructor(token?: string) {
    const finalToken = token || getGiteaToken();
    this.client = axios.create({
      baseURL: GITEA_BASE_URL,
      headers: {
        Accept: 'application/json',
        ...(finalToken ? { Authorization: `token ${finalToken}` } : {}),
      },
    });
  }

  async listSkills(): Promise<string[]> {
    try {
      const url = `/api/v1/repos/${GITEA_OWNER}/${GITEA_REPO}/contents/${GITEA_ROOT_PATH}`;
      const response = await this.client.get<GiteaFile[]>(url);

      if (!Array.isArray(response.data)) {
         throw new Error('Invalid response from Gitea API: Expected array');
      }

      return response.data
        .filter(item => item.type === 'dir')
        .map(item => item.name);
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
         throw new Error('Skills directory not found or repository does not exist.');
      }
      throw error;
    }
  }

  async downloadSkill(skillName: string, destPath: string, onProgress?: DownloadProgressCallback): Promise<void> {
    const sourcePath = `${GITEA_ROOT_PATH}/${skillName}`;
    try {
      await this.downloadRecursive(sourcePath, destPath, onProgress);
    } catch (error: any) {
       if (error.response && error.response.status === 404) {
         throw new Error(`Skill '${skillName}' not found.`);
      }
      throw error;
    }
  }

  private async downloadRecursive(sourcePath: string, destPath: string, onProgress?: DownloadProgressCallback): Promise<void> {
    const url = `/api/v1/repos/${GITEA_OWNER}/${GITEA_REPO}/contents/${sourcePath}`;
    const response = await this.client.get<GiteaFile[]>(url);

    if (!Array.isArray(response.data)) {
        // It might be a single file if we pointed to a file, but for skills it should be a dir
        throw new Error(`Path '${sourcePath}' is not a directory.`);
    }

    // Create destination directory
    fs.mkdirSync(destPath, { recursive: true });

    for (const item of response.data) {
      if (item.type === 'file') {
        if (onProgress) {
           // We pass the relative path from the skill root if we wanted, but here we just pass filename or relative path
           // simpler to pass item.path which is full gitea path, or item.name.
           // Let's pass item.name for simplicity, or we can try to show context.
           onProgress(item.name);
        }
        await this.downloadFile(item, destPath);
      } else if (item.type === 'dir') {
        const newDestPath = path.join(destPath, item.name);
        await this.downloadRecursive(item.path, newDestPath, onProgress);
      }
    }
  }

  private async downloadFile(item: GiteaFile, destDir: string): Promise<void> {
    if (!item.download_url) {
      throw new Error(`No download URL for file ${item.name}`);
    }

    // Use the client to keep authentication headers
    const response = await this.client.get(item.download_url, {
        responseType: 'arraybuffer'
    });

    const filePath = path.join(destDir, item.name);
    fs.writeFileSync(filePath, response.data);
  }
}
