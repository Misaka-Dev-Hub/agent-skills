import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import ora from 'ora';
import { GiteaClient } from '../api.js';
import { getGiteaToken } from '../config.js';

export async function addCommand(skillName?: string) {
  const token = getGiteaToken();
  if (!token) {
    console.error(chalk.red("未登录：请运行 'npx myskills login' 或设置 GITEA_TOKEN 环境变量"));
    process.exit(1);
  }

  const client = new GiteaClient();

  if (skillName) {
    await installSingleSkill(client, skillName);
  } else {
    await installInteractive(client);
  }
}

async function installSingleSkill(client: GiteaClient, skillName: string) {
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

  try {
    await client.downloadSkill(skillName, targetDir, (fileName) => {
        spinner.text = chalk.blue(`⬇️ 正在下载: ${fileName}`);
    });
    spinner.succeed(chalk.green(`安装成功！已保存至 ${targetDir}`));
  } catch (error: any) {
    handleError(error, spinner);
    process.exit(1);
  }
}

async function installInteractive(client: GiteaClient) {
  const spinner = ora(chalk.cyan('🔍 正在获取可用 Skills...')).start();
  let skills: string[] = [];

  try {
    skills = await client.listSkills();
    spinner.stop();
  } catch (error: any) {
    handleError(error, spinner);
    process.exit(1);
  }

  if (skills.length === 0) {
    console.log(chalk.yellow('仓库中暂无可用 Skill。'));
    return;
  }

  const { selectedSkills } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedSkills',
      message: '请选择要安装的 Skills (空格选择):',
      choices: skills,
      validate: (answer) => {
        if (answer.length < 1) return '请至少选择一个 Skill';
        return true;
      }
    }
  ]);

  console.log(chalk.blue(`\n开始批量安装 ${selectedSkills.length} 个 Skills...\n`));

  const results = {
    success: [] as string[],
    skipped: [] as string[],
    failed: [] as string[],
  };

  for (let i = 0; i < selectedSkills.length; i++) {
    const skillName = selectedSkills[i];
    const targetDir = path.resolve(process.cwd(), '.claude/skills', skillName);
    const progressPrefix = `[${i + 1}/${selectedSkills.length}]`;

    if (fs.existsSync(targetDir)) {
      results.skipped.push(skillName);
      console.log(chalk.yellow(`${progressPrefix} ⚠ 跳过 ${skillName} (目录已存在)`));
      continue;
    }

    const itemSpinner = ora(`${progressPrefix} 正在安装: ${skillName}...`).start();
    try {
      await client.downloadSkill(skillName, targetDir, (fileName) => {
          itemSpinner.text = chalk.blue(`${progressPrefix} 正在下载: ${skillName} / ${fileName}`);
      });
      itemSpinner.succeed(chalk.green(`${progressPrefix} 安装成功: ${skillName}`));
      results.success.push(skillName);
    } catch (error: any) {
      itemSpinner.fail(chalk.red(`${progressPrefix} 安装失败: ${skillName} (${error.message})`));
      results.failed.push(skillName);
    }
  }

  // Summary Report
  console.log('\n' + chalk.bold('📊 安装任务汇总:'));
  console.log(chalk.dim('────────────────────────────'));

  if (results.success.length > 0) {
    results.success.forEach(name => console.log(chalk.green(`✔ ${name}`)));
  }
  if (results.skipped.length > 0) {
    results.skipped.forEach(name => console.log(chalk.yellow(`⚠ ${name} (已跳过)`)));
  }
  if (results.failed.length > 0) {
    results.failed.forEach(name => console.log(chalk.red(`✖ ${name} (失败)`)));
  }

  console.log(chalk.dim('────────────────────────────'));
  console.log(
    `🎉 总计: ${selectedSkills.length} | 成功: ${chalk.green(results.success.length)} | 跳过: ${chalk.yellow(results.skipped.length)} | 失败: ${chalk.red(results.failed.length)}\n`
  );
}

function handleError(error: any, spinner: any) {
    let errorMessage = error.message;
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
         errorMessage = 'Authentication failed: Invalid token or insufficient permissions.';
    }
    spinner.fail(chalk.red(`操作失败: ${errorMessage}`));
}
