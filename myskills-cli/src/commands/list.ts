import chalk from 'chalk';
import ora from 'ora';
import { GiteaClient } from '../api.js';
import { getGiteaToken } from '../config.js';

export async function listCommand() {
  const token = getGiteaToken();
  if (!token) {
    console.error(chalk.red("未登录：请运行 'npx myskills login' 或设置 GITEA_TOKEN 环境变量"));
    process.exit(1);
  }

  const spinner = ora(chalk.cyan('🔍 正在从 Gitea 获取 Skill 列表...')).start();
  const client = new GiteaClient();

  try {
    const skills = await client.listSkills();

    if (skills.length === 0) {
      spinner.stopAndPersist({ symbol: '⚠️', text: chalk.yellow('No skills found.') });
      return;
    }

    spinner.stopAndPersist({ symbol: '📦', text: chalk.green('成功获取以下 Skills:') });
    skills.forEach(skill => {
      console.log(`  - ${skill}`);
    });
  } catch (error: any) {
    let errorMessage = error.message;
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
         errorMessage = 'Authentication failed: Invalid token or insufficient permissions.';
    }
    spinner.fail(chalk.red(`获取列表失败: ${errorMessage}`));
    process.exit(1);
  }
}
