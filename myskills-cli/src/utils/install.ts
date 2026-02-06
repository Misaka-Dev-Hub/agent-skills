import fs from 'fs';
import path from 'path';
import { GiteaClient, DownloadProgressCallback } from '../api.js';
import { SkillMetadata } from '../types.js';
import { GITEA_ROOT_PATH } from '../config.js';

export async function installSkill(
  client: GiteaClient,
  skillName: string,
  targetDir: string,
  onProgress?: DownloadProgressCallback
): Promise<SkillMetadata> {
  const remotePath = `${GITEA_ROOT_PATH}/${skillName}`;

  // 1. Get SHA
  const sha = await client.getLatestCommitSha(remotePath);

  // 2. Download
  await client.downloadSkill(skillName, targetDir, onProgress);

  // 3. Write Metadata
  const metadata: SkillMetadata = {
    name: skillName,
    install_path: targetDir,
    remote_path: remotePath,
    installed_at: new Date().toISOString(),
    commit_sha: sha,
  };

  const metaPath = path.join(targetDir, '.myskills.meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

  return metadata;
}
