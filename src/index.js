import { readFileContent } from './utils/file-utils.js';
import { reviewWithDeepseek } from './reviewers/deepseek.js';
import { createSpinner } from './utils/spinner.js';
import { formatOutput } from './utils/formatter.js';
import chalk from 'chalk';

/**
 * Main function to review code using DeepSeek AI model
 * @param {Object} options - Review options
 * @param {string} [options.filePath] - Path to the file to review
 * @param {string} [options.codeSnippet] - Code snippet to review
 * @param {string[]} [options.focusAreas=['general']] - Focus areas for the review
 * @param {number} [options.deepseekTimeout=40000] - Timeout for DeepSeek API in ms
 * @param {string} [options.outputFormat='text'] - Output format (text, json, markdown)
 * @param {boolean} [options.verbose=false] - Enable verbose output
 * @param {Object} [options.config={}] - Configuration object
 * @returns {Promise<Object>} - Review results
 */
export async function reviewCode(options) {
  const {
    filePath,
    codeSnippet,
    focusAreas = ['general'],
    deepseekTimeout = 40000,
    outputFormat = 'text',
    verbose = false,
    config = {}
  } = options;

  // Get code content either from file or directly from input
  let codeContent;
  let sourceType;
  let sourceName;

  if (filePath) {
    const spinner = createSpinner('Reading file...');
    try {
      codeContent = await readFileContent(filePath);
      sourceType = 'file';
      sourceName = filePath;
      spinner.succeed(`File read: ${filePath}`);
    } catch (error) {
      spinner.fail(`Failed to read file: ${error.message}`);
      throw error;
    }
  } else if (codeSnippet) {
    codeContent = codeSnippet;
    sourceType = 'snippet';
    sourceName = 'Code Snippet';
  } else {
    throw new Error('Either filePath or codeSnippet must be provided');
  }

  if (verbose) {
    console.log(chalk.blue('Focus Areas:'), focusAreas.join(', '));
    console.log(chalk.blue('Source:'), sourceName);
  }

  const results = {
    sourceType,
    sourceName,
    focusAreas,
    deepseek: null,
    timestamp: new Date().toISOString()
  };

  // Run DeepSeek review
  const deepseekSpinner = createSpinner('Running DeepSeek code review...');
  try {
    results.deepseek = await reviewWithDeepseek({
      code: codeContent,
      focusAreas,
      timeout: deepseekTimeout,
      config
    });
    deepseekSpinner.succeed('DeepSeek review completed');
  } catch (error) {
    deepseekSpinner.fail(`DeepSeek review failed: ${error.message}`);
    if (verbose) {
      console.error(chalk.red('DeepSeek Error Details:'), error);
    }
    results.deepseek = { error: error.message };
  }

  // Format and output results
  const formattedOutput = formatOutput(results, outputFormat);
  
  // In text/markdown mode, print to console
  if (outputFormat === 'text' || outputFormat === 'markdown') {
    console.log(formattedOutput);
  } else if (outputFormat === 'json') {
    console.log(JSON.stringify(results, null, 2));
  }

  return results;
}
