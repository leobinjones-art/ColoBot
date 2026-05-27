#!/usr/bin/env node
/**
 * ColoMind CLI
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const { program } = require('commander')

program
  .name('colomind')
  .description('TypeScript AI Agent Framework')
  .version('0.3.1')

program
  .command('init')
  .description('Initialize configuration')
  .action(() => {
    console.log('Initializing ColoMind...')
    console.log('Please create ~/.colomind/config.json with your API keys')
  })

program
  .command('tui')
  .description('Start terminal UI')
  .action(() => {
    console.log('Starting TUI...')
    console.log('Run: npx @colomind/tui')
  })

program.parse()