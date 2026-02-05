import chalk from 'chalk';
import { GiteaClient } from '../api.js';
import { getGiteaToken } from '../config.js';

export async function listCommand() {
  const token = getGiteaToken();
  if (!token) {
    console.error(chalk.red('Authentication failed: GITEA_TOKEN environment variable is not set.'));
    process.exit(1);
  }

  const client = new GiteaClient();

  try {
    console.log(chalk.blue('Fetching available skills...'));
    const skills = await client.listSkills();

    if (skills.length === 0) {
      console.log(chalk.yellow('No skills found.'));
      return;
    }

    console.log(chalk.green('Available Skills:'));
    skills.forEach(skill => {
      console.log(`- ${skill}`);
    });
  } catch (error: any) {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
         console.error(chalk.red('Authentication failed: Invalid token or insufficient permissions.'));
    } else {
        console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}
