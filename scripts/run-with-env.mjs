#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const separatorIndex = process.argv.indexOf('--');
const optionArgs = separatorIndex >= 0 ? process.argv.slice(2, separatorIndex) : process.argv.slice(2);
const rawCommandArgs = separatorIndex >= 0 ? process.argv.slice(separatorIndex + 1) : [];
const commandArgs = stripLeadingSeparators(rawCommandArgs);
const envFile = readEnvFileOption(optionArgs);
const dryRun = optionArgs.includes('--dry-run');

if (!envFile || commandArgs.length === 0) {
  console.error('Usage: node ./scripts/run-with-env.mjs --env <file> -- <command>');
  process.exit(1);
}

const command = commandArgs.join(' ').trim();
const env = loadChildEnv(envFile);

if (dryRun) {
  console.info(`${envFile}: ${command}`);
  process.exit(0);
}

const child = spawn(command, {
  cwd: repoRoot,
  env,
  shell: true,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});

function readEnvFileOption(args) {
  const index = args.indexOf('--env');
  if (index < 0) {
    return null;
  }

  return args[index + 1] ?? null;
}

function stripLeadingSeparators(args) {
  const result = [...args];
  while (result[0] === '--') {
    result.shift();
  }
  return result;
}

function loadChildEnv(file) {
  const envPath = resolve(repoRoot, file);
  const parsed = dotenv.parse(readFileSync(envPath));

  return {
    ...process.env,
    ...parsed,
  };
}
