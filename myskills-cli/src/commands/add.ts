import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import ora from 'ora';
import { GiteaClient } from '../api.js';
import { getGiteaToken } from '../config.js';

export async function addCommand(skillName: string) {
  const token = getGiteaToken();
  if (!token) {
    console.error(chalk.red("未登录：请运行 'npx myskills login' 或设置 GITEA_TOKEN 环境变量"));
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), '.claude/skills', skillName);

  // Handle overwrite prompt BEFORE starting spinner
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

  const spinner = ora(chalk.cyan(`📡 正在获取 ${skillName} 文件清单...`)).start();
  const client = new GiteaClient();

  try {
    // Pass spinner callback to update text
    await client.downloadSkill(skillName, targetDir, (fileName, current, total) => {
        spinner.text = chalk.blue(`⬇️ 正在下载 (${current}/${total}): ${fileName}`);
    });
    spinner.succeed(chalk.green(`安装成功！已保存至 ${targetDir}`));
  } catch (error: any) {
    let errorMessage = error.message;
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
         errorMessage = 'Authentication failed: Invalid token or insufficient permissions.';
    }
    spinner.fail(chalk.red(`下载失败: ${errorMessage}`));
    process.exit(1);
  }
}
