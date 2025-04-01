import chalk from 'chalk';

/**
 * Formats the review results based on the specified output format
 * @param {Object} results - Review results
 * @param {string} format - Output format (text, json, markdown)
 * @returns {string} - Formatted output
 */
export function formatOutput(results, format = 'text') {
  switch (format.toLowerCase()) {
    case 'json':
      return JSON.stringify(results, null, 2);
    case 'markdown':
      return formatMarkdown(results);
    case 'text':
    default:
      return formatText(results);
  }
}

/**
 * Formats the review results as plain text
 * @param {Object} results - Review results
 * @returns {string} - Formatted text
 */
function formatText(results) {
  const { sourceType, sourceName, focusAreas, deepseek, timestamp } = results;
  
  let output = '';
  
  // Header
  output += chalk.bold.blue('===== AI CODE REVIEW REPORT =====\n');
  output += `${chalk.bold('Source:')} ${sourceName} (${sourceType})\n`;
  output += `${chalk.bold('Focus Areas:')} ${focusAreas.join(', ')}\n`;
  output += `${chalk.bold('Timestamp:')} ${timestamp}\n\n`;
  
  // DeepSeek results
  if (deepseek) {
    output += chalk.bold.cyan('===== DEEPSEEK REVIEW =====\n');
    
    if (deepseek.error) {
      output += chalk.red(`Error: ${deepseek.error}\n\n`);
    } else {
      // If summary already contains the quick stats and key issues, just display it directly
      output += `${deepseek.summary}\n\n`;
      
      // Only show these sections if they're not already included in the summary
      if (!deepseek.summary.includes('## Issues') && !deepseek.summary.includes('### Issues')) {
        output += chalk.bold('Issues:\n');
        if (deepseek.issues.critical.length > 0) {
          output += chalk.bold.red('CRITICAL:\n');
          deepseek.issues.critical.forEach(issue => {
            output += `  - ${issue}\n`;
          });
          output += '\n';
        }
        
        if (deepseek.issues.high.length > 0) {
          output += chalk.bold.yellow('HIGH:\n');
          deepseek.issues.high.forEach(issue => {
            output += `  - ${issue}\n`;
          });
          output += '\n';
        }
        
        if (deepseek.issues.medium.length > 0) {
          output += chalk.bold.blue('MEDIUM:\n');
          deepseek.issues.medium.forEach(issue => {
            output += `  - ${issue}\n`;
          });
          output += '\n';
        }
        
        if (deepseek.issues.low.length > 0) {
          output += chalk.bold.green('LOW:\n');
          deepseek.issues.low.forEach(issue => {
            output += `  - ${issue}\n`;
          });
          output += '\n';
        }
      }
      
      if (!deepseek.summary.includes('## Recommendations') && !deepseek.summary.includes('### Recommendations')) {
        output += chalk.bold('Recommendations:\n');
        output += `${deepseek.recommendations}\n\n`;
      }
      
      if (!deepseek.summary.includes('## Strengths') && !deepseek.summary.includes('### Strengths')) {
        output += chalk.bold('Strengths:\n');
        output += `${deepseek.strengths}\n\n`;
      }
    }
  }
  
  // Summary
  output += chalk.bold.blue('===== SUMMARY =====\n');
  const hasDeepseekResults = deepseek && !deepseek.error;
  
  if (hasDeepseekResults) {
    output += 'DeepSeek review completed successfully.\n';
  } else {
    output += chalk.red('No reviews completed successfully.\n');
  }
  
  return output;
}

/**
 * Formats the review results as markdown
 * @param {Object} results - Review results
 * @returns {string} - Formatted markdown
 */
function formatMarkdown(results) {
  const { sourceType, sourceName, focusAreas, deepseek, timestamp } = results;
  
  let output = '';
  
  // Header
  output += '# AI Code Review Report\n\n';
  output += `**Source:** ${sourceName} (${sourceType})  \n`;
  output += `**Focus Areas:** ${focusAreas.join(', ')}  \n`;
  output += `**Timestamp:** ${timestamp}  \n\n`;
  
  // DeepSeek results
  if (deepseek) {
    output += '## DeepSeek Review\n\n';
    
    if (deepseek.error) {
      output += `**Error:** ${deepseek.error}\n\n`;
    } else {
      // If summary already contains the quick stats and key issues, just display it directly
      output += `${deepseek.summary}\n\n`;
      
      // Only show these sections if they're not already included in the summary
      if (!deepseek.summary.includes('## Issues') && !deepseek.summary.includes('### Issues')) {
        output += '### Issues\n\n';
        if (deepseek.issues.critical.length > 0) {
          output += '#### CRITICAL\n\n';
          deepseek.issues.critical.forEach(issue => {
            output += `- ${issue}\n`;
          });
          output += '\n';
        }
        
        if (deepseek.issues.high.length > 0) {
          output += '#### HIGH\n\n';
          deepseek.issues.high.forEach(issue => {
            output += `- ${issue}\n`;
          });
          output += '\n';
        }
        
        if (deepseek.issues.medium.length > 0) {
          output += '#### MEDIUM\n\n';
          deepseek.issues.medium.forEach(issue => {
            output += `- ${issue}\n`;
          });
          output += '\n';
        }
        
        if (deepseek.issues.low.length > 0) {
          output += '#### LOW\n\n';
          deepseek.issues.low.forEach(issue => {
            output += `- ${issue}\n`;
          });
          output += '\n';
        }
      }
      
      if (!deepseek.summary.includes('## Recommendations') && !deepseek.summary.includes('### Recommendations')) {
        output += '### Recommendations\n\n';
        output += `${deepseek.recommendations}\n\n`;
      }
      
      if (!deepseek.summary.includes('## Strengths') && !deepseek.summary.includes('### Strengths')) {
        output += '### Strengths\n\n';
        output += `${deepseek.strengths}\n\n`;
      }
    }
  }
  
  // Summary
  output += '## Summary\n\n';
  const hasDeepseekResults = deepseek && !deepseek.error;
  
  if (hasDeepseekResults) {
    output += 'DeepSeek review completed successfully.\n';
  } else {
    output += '**No reviews completed successfully.**\n';
  }
  
  return output;
}
