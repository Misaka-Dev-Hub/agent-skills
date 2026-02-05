#!/usr/bin/env node

import { Command } from 'commander';
import { listCommand } from './commands/list.js';
import { addCommand } from './commands/add.js';
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
  .command('add <skill_name>')
  .description('Download and install a skill')
  .action(async (skillName) => {
    await addCommand(skillName);
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
