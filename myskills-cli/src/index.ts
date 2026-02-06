#!/usr/bin/env node

import { Command } from 'commander';
import { listCommand } from './commands/list.js';
import { addCommand } from './commands/add.js';
import { outdatedCommand } from './commands/outdated.js';
import { upgradeCommand } from './commands/upgrade.js';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

const program = new Command();

program
  .name('myskills')
  .description('MySkills CLI - Download and deploy AI Skills from Gitea')
  .version(packageJson.version);

program
  .command('list')
  .description('List available skills in the remote repository')
  .action(async () => {
    await listCommand();
  });

program
  .command('add [skill_name]')
  .description('Download and install a skill (interactive if no name provided)')
  .action(async (skillName) => {
    await addCommand(skillName);
  });

program
  .command('outdated')
  .description('Check for outdated skills')
  .action(async () => {
    await outdatedCommand();
  });

program
  .command('upgrade [skill_name]')
  .description('Upgrade a skill (or all with --all)')
  .option('-a, --all', 'Upgrade all outdated skills')
  .action(async (skillName, options) => {
    await upgradeCommand(skillName, options);
  });

program
  .command('login')
  .description('Authenticate with Gitea and save token locally')
  .action(async () => {
    await loginCommand();
  });

program
  .command('logout')
  .description('Remove locally saved Gitea token')
  .action(async () => {
    await logoutCommand();
  });

program.parse(process.argv);
