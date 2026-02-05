import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { GiteaClient } from '../api.js';
import { getGiteaToken } from '../config.js';

export async function addCommand(skillName: string) {
  const token = getGiteaToken();
  if (!token) {
    console.error(chalk.red("未登录：请运行 'npx myskills login' 或设置 GITEA_TOKEN 环境变量"));
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), '.claude/skills', skillName);

  if (fs.existsSync(targetDir)) {
    console.log(chalk.yellow(`Directory already exists: ${targetDir}`));
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Directory already exists, overwrite? (Y/N)',
        default: false,
      },
    ]);

    if (!answer.overwrite) {
      console.log(chalk.yellow('Operation cancelled.'));
      return;
    }
  }

  const client = new GiteaClient();

  try {
    console.log(chalk.blue(`Downloading skill '${skillName}'...`));
    await client.downloadSkill(skillName, targetDir);
    console.log(chalk.green(`Successfully installed skill '${skillName}' to ${targetDir}`));
  } catch (error: any) {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
         console.error(chalk.red('Authentication failed: Invalid token or insufficient permissions.'));
    } else {
        console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}
