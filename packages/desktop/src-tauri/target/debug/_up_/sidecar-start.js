#!/usr/bin/env node
// Entry point for sidecar - resolves to the tsx runner
const { spawn } = require('child_process');
const path = require('path');

const sidecarDir = path.join(__dirname, '..', 'sidecar');
const tsxPath = path.join(__dirname, '..', 'node_modules', '.bin', 'tsx');
const sidecarEntry = path.join(sidecarDir, 'index.ts');

const child = spawn(tsxPath, [sidecarEntry], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, SIDECAR_PORT: process.env.SIDECAR_PORT || '3456' }
});

child.stdout.on('data', (data) => {
  process.stdout.write(data);
});

child.stderr.on('data', (data) => {
  process.stderr.write(data);
});

child.on('exit', (code) => process.exit(code || 0));
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
