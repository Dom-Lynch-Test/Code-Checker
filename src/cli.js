import { program } from 'commander';
import { reviewCode } from './index.js';
import chalk from 'chalk';
import { loadConfig } from './utils/config.js';

/**
 * Runs the CLI application
 * @param {string[]} args - Command line arguments
 */
export async function runCLI(args) {
  // Load configuration from .env and .aicodereviewrc
  const config = loadConfig();

  program
    .name('ai-code-review')
    .description('Dual AI code review tool using DeepSeek and Gemini models')
    .version('0.1.0');

  program
    .option('-f, --file <path>', 'Path to the file to review')
    .option('-c, --code <string>', 'Code snippet to review (as a string)')
    .option('--focus <areas>', 'Focus areas for review (comma-separated: security,performance,readability,maintainability)', 'general')
    .option('--timeout <seconds>', 'Timeout for DeepSeek API in seconds', '40')
    .option('--output <format>', 'Output format (text, json, markdown)', 'text')
    .option('--verbose', 'Enable verbose output', false);

  program.parse(args);

  const options = program.opts();

  // Validate input
  if (!options.file && !options.code) {
    console.error(chalk.red('Error: Either --file or --code must be provided'));
    program.help();
    process.exit(1);
  }

  if (options.file && options.code) {
    console.error(chalk.red('Error: Cannot use both --file and --code at the same time'));
    program.help();
    process.exit(1);
  }

  // Convert focus areas to array
  const focusAreas = options.focus.split(',').map(area => area.trim());

  // Validate focus areas
  const validFocusAreas = ['security', 'performance', 'readability', 'maintainability', 'general'];
  const invalidFocusAreas = focusAreas.filter(area => !validFocusAreas.includes(area));

  if (invalidFocusAreas.length > 0) {
    console.error(chalk.yellow(`Warning: Unknown focus areas: ${invalidFocusAreas.join(', ')}`));
    console.error(chalk.yellow(`Valid focus areas are: ${validFocusAreas.join(', ')}`));
    console.log(chalk.blue('Proceeding with valid focus areas only...'));
    // Filter out invalid focus areas
    const filteredFocusAreas = focusAreas.filter(area => validFocusAreas.includes(area));
    if (filteredFocusAreas.length === 0) {
      // If no valid focus areas remain, default to general
      filteredFocusAreas.push('general');
    }
    // Update focusAreas with only valid ones
    focusAreas.length = 0;
    filteredFocusAreas.forEach(area => focusAreas.push(area));
  }

  try {
    // Run the code review
    const result = await reviewCode({
      filePath: options.file,
      codeSnippet: options.code,
      focusAreas,
      deepseekTimeout: parseInt(options.timeout, 10) * 1000,
      skipGemini: true,
      outputFormat: options.output,
      verbose: options.verbose,
      config
    });

    // Output is handled by the reviewCode function based on the outputFormat
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    if (options.verbose && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}
