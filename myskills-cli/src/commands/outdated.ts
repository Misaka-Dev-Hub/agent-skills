import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import { GiteaClient } from '../api.js';
import { getGiteaToken } from '../config.js';
import { SkillMetadata } from '../types.js';

export async function outdatedCommand() {
  const token = getGiteaToken();
  if (!token) {
    console.error(chalk.red("未登录：请运行 'npx myskills login' 或设置 GITEA_TOKEN 环境变量"));
    process.exit(1);
  }

  const skillsDir = path.resolve(process.cwd(), '.claude/skills');
  if (!fs.existsSync(skillsDir)) {
    console.log(chalk.yellow('No skills installed yet.'));
    return;
  }

  const skillDirs = fs.readdirSync(skillsDir).filter(file => {
      return fs.statSync(path.join(skillsDir, file)).isDirectory();
  });

  if (skillDirs.length === 0) {
      console.log(chalk.yellow('No skills installed.'));
      return;
  }

  console.log(chalk.blue(`🔍 Checking for updates...`));
  const spinner = ora('Fetching remote versions...').start();
  const client = new GiteaClient();

  const results = await Promise.all(skillDirs.map(async (skillName) => {
      const dirPath = path.join(skillsDir, skillName);
      const metaPath = path.join(dirPath, '.myskills.meta.json');

      let localSha = 'UNKNOWN';
      let remoteSha = '------';
      let status = chalk.gray('? Meta missing');
      let remotePath = `skills/${skillName}`; // Fallback guess

      if (fs.existsSync(metaPath)) {
          try {
              const meta: SkillMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
              localSha = meta.commit_sha;
              remotePath = meta.remote_path;

              // Fetch remote
              const fetchedSha = await client.getLatestCommitSha(remotePath);
              if (fetchedSha) {
                  remoteSha = fetchedSha;
                  if (fetchedSha === localSha) {
                      status = chalk.green('✔ Up to date');
                  } else {
                      status = chalk.yellow('⬆ Update available');
                  }
              } else {
                  status = chalk.red('✖ Network Error');
              }

          } catch (e) {
              status = chalk.red('✖ Invalid Meta');
          }
      } else {
          // Meta missing
      }

      return {
          name: skillName,
          local: localSha,
          latest: remoteSha,
          status: status
      };
  }));

  spinner.stop();

  const table = new Table({
      head: ['Skill Name', 'Current', 'Latest', 'Status'],
      style: { head: ['cyan'] }
  });

  results.forEach(r => {
      table.push([
          r.name,
          r.local.substring(0, 7),
          r.latest.substring(0, 7),
          r.status
      ]);
  });

  console.log(table.toString());
}
