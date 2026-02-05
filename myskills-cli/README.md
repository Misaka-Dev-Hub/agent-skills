# MySkills CLI

MySkills CLI is a command-line tool designed to automatically download and deploy AI Skills from a private Gitea repository to your local Claude environment.

## Features

- **Skill Discovery**: List all available skills from the remote repository.
- **Automated Installation**: Download skills directly to your local `.claude/skills` directory.
- **Safety**: Prevents accidental overwrites of existing skills.

## Prerequisites

- Node.js (v18 or higher recommended)
- Access to the private Gitea repository
- A valid Gitea Access Token

## Installation

1. Navigate to the `myskills-cli` directory:
   ```bash
   cd myskills-cli
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. (Optional) Link the package globally to use `myskills` command anywhere:
   ```bash
   npm link
   ```

## Configuration

The tool requires a Gitea Access Token to authenticate with the repository. You must set this token as an environment variable.

### Setting the Environment Variable

**Linux / macOS:**
```bash
export GITEA_TOKEN=your_token_here
```

**Windows (PowerShell):**
```powershell
$env:GITEA_TOKEN="your_token_here"
```

**Windows (CMD):**
```cmd
set GITEA_TOKEN=your_token_here
```

## Usage

### List Available Skills

View a list of all skills available for download:

```bash
myskills list
```
*Or if running from source:* `npm start list`

### Install a Skill

Download and install a specific skill:

```bash
myskills add <skill_name>
```
*Or if running from source:* `npm start add <skill_name>`

**Example:**
```bash
myskills add agent-logger
```

This will download the `agent-logger` skill to `./.claude/skills/agent-logger/`.

## Troubleshooting

- **Authentication Failed**: Ensure your `GITEA_TOKEN` is set correctly and has permission to access the repository.
- **Directory Exists**: If the target directory already exists, the tool will ask for confirmation before overwriting.
