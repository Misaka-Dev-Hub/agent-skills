import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { GiteaClient } from '../api.js';
import { getGiteaToken } from '../config.js';
import { SkillMetadata } from '../types.js';
import { installSkill } from '../utils/install.js';

export async function upgradeCommand(skillName?: string, options?: { all: boolean }) {
  const token = getGiteaToken();
  if (!token) {
    console.error(chalk.red("未登录：请运行 'npx myskills login' 或设置 GITEA_TOKEN 环境变量"));
    process.exit(1);
  }

  const client = new GiteaClient();

  if (options?.all) {
      await upgradeAll(client);
  } else if (skillName) {
      await upgradeSingle(client, skillName);
  } else {
      console.error(chalk.red('Please provide a skill name or use --all'));
      process.exit(1);
  }
}

async function upgradeSingle(client: GiteaClient, skillName: string) {
    const spinner = ora(`Checking updates for ${skillName}...`).start();
    const targetDir = path.resolve(process.cwd(), '.claude/skills', skillName);
    const metaPath = path.join(targetDir, '.myskills.meta.json');

    if (!fs.existsSync(targetDir)) {
        spinner.fail(chalk.red(`Skill ${skillName} is not installed.`));
        return;
    }

    if (!fs.existsSync(metaPath)) {
        spinner.fail(chalk.red(`Metadata missing for ${skillName}. Cannot upgrade safely.`));
        return;
    }

    try {
        const meta: SkillMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        const remoteSha = await client.getLatestCommitSha(meta.remote_path);

        if (!remoteSha) {
             spinner.fail(chalk.red(`Failed to fetch remote version for ${skillName}.`));
             return;
        }

        if (remoteSha === meta.commit_sha) {
            spinner.succeed(chalk.green(`${skillName} is already up to date.`));
            return;
        }

        spinner.text = `Upgrading ${skillName}...`;

        // Backup
        const backupDir = `${targetDir}.bak`;
        fs.renameSync(targetDir, backupDir);

        try {
            // Install
            await installSkill(client, skillName, targetDir);

            // Verify
            if (fs.readdirSync(targetDir).length === 0) {
                throw new Error('Installation result is empty');
            }

            // Commit
            fs.rmSync(backupDir, { recursive: true, force: true });
            spinner.succeed(chalk.green(`Successfully upgraded ${skillName}!`));

        } catch (err: any) {
            // Rollback
            if (fs.existsSync(targetDir)) {
                fs.rmSync(targetDir, { recursive: true, force: true });
            }
            fs.renameSync(backupDir, targetDir);
            spinner.fail(chalk.red(`Upgrade failed for ${skillName}, rolled back to previous version. Error: ${err.message}`));
        }

    } catch (error: any) {
        spinner.fail(chalk.red(`Error: ${error.message}`));
    }
}

async function upgradeAll(client: GiteaClient) {
    const skillsDir = path.resolve(process.cwd(), '.claude/skills');
     if (!fs.existsSync(skillsDir)) {
        console.log(chalk.yellow('No skills installed.'));
        return;
    }

    const skillDirs = fs.readdirSync(skillsDir).filter(file => {
        return fs.statSync(path.join(skillsDir, file)).isDirectory();
    });

    console.log(chalk.blue(`Checking for updates...`));

    for (const skillName of skillDirs) {
        await upgradeSingle(client, skillName);
    }
}
