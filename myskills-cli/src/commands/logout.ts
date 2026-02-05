import chalk from 'chalk';
import { clearGiteaToken } from '../config.js';

export async function logoutCommand() {
  clearGiteaToken();
  console.log(chalk.green('✅ Logged out. Token cleared.'));
}
