#!/usr/bin/env node
/**
 * ColoBot CLI 入口
 * 代理到 @nexusmind/core 的 CLI
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cliPath = join(__dirname, '..', '..', 'core', 'dist', 'cli.js')

const child = spawn('node', [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false,
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
