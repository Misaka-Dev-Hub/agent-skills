import inquirer from 'inquirer';
import chalk from 'chalk';
import { setGiteaToken, getConfigPath } from '../config.js';
import { GiteaClient } from '../api.js';

export async function loginCommand() {
  while (true) {
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

    const token = answers.token.trim();
    console.log(chalk.blue('Verifying token...'));

    const client = new GiteaClient(token);

    try {
      // Try to list skills to verify token
      await client.listSkills();

      // If successful, save token
      setGiteaToken(token);
      console.log(chalk.green('✅ Login Successful!'));
      console.log(chalk.dim(`Config saved at: ${getConfigPath()}`));
      break; // Exit loop

    } catch (error: any) {
      console.error(chalk.red('❌ Authentication failed: Invalid token or insufficient permissions.'));

      const retryAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Try again', value: 'retry' },
            { name: 'Exit', value: 'exit' }
          ]
        }
      ]);

      if (retryAnswer.action === 'exit') {
        console.log(chalk.yellow('Login cancelled.'));
        process.exit(1);
      }
      // Loop continues if action is 'retry'
    }
  }
}
