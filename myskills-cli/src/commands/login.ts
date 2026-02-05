import inquirer from 'inquirer';
import chalk from 'chalk';
import { setGiteaToken, getConfigPath } from '../config.js';

export async function loginCommand() {
  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      message: 'Please enter your Gitea Token:',
      mask: '*',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Token cannot be empty.';
        }
        return true;
      },
    },
  ]);

  setGiteaToken(answers.token);

  console.log(chalk.green('✅ Login Successful!'));
  console.log(chalk.dim(`Config saved at: ${getConfigPath()}`));
}
