import fetch from 'node-fetch';

/**
 * Custom error classes for better error handling
 */
class DeepseekApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'DeepseekApiError';
    this.statusCode = statusCode;
  }
}

class DeepseekTimeoutError extends Error {
  constructor(message, chunkNumber) {
    super(message);
    this.name = 'DeepseekTimeoutError';
    this.chunkNumber = chunkNumber;
  }
}

class DeepseekParsingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DeepseekParsingError';
  }
}

/**
 * Reviews code using the DeepSeek API
 * @param {Object} options - Review options
 * @param {string} options.code - Code content to review
 * @param {string[]} options.focusAreas - Focus areas for the review
 * @param {number} options.timeout - Timeout in milliseconds
 * @param {Object} options.config - Configuration object with API keys
 * @returns {Promise<Object>} - Review results
 */
export async function reviewWithDeepseek({ code, focusAreas, timeout, config }) {
  // Check if API key is available
  const apiKey = config.DEEPSEEK_API_KEY || config.NEXT_PUBLIC_DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DeepSeek API key not found. Set DEEPSEEK_API_KEY or NEXT_PUBLIC_DEEPSEEK_API_KEY in .env or .aicodereviewrc');
  }

  // Split code into chunks if it's too large
  const chunks = splitCodeIntoChunks(code, 3000); // ~3000 chars per chunk
  const totalChunks = chunks.length;
  
  console.log(`Code split into ${totalChunks} chunks for DeepSeek review`);
  
  // Process chunks in parallel with progress tracking
  const chunkResults = [];
  const errors = [];
  const chunkPromises = [];
  const chunkStatus = new Array(chunks.length).fill('pending');
  
  // Create a function to update progress
  const updateProgress = () => {
    const completed = chunkStatus.filter(status => status === 'completed').length;
    const failed = chunkStatus.filter(status => status === 'failed').length;
    const inProgress = chunkStatus.filter(status => status === 'in-progress').length;
    const retrying = chunkStatus.filter(status => status === 'retrying').length;
    const pending = chunkStatus.filter(status => status === 'pending').length;
    
    const progressBar = chunkStatus.map(status => {
      if (status === 'completed') return '✓';
      if (status === 'failed') return '✗';
      if (status === 'in-progress') return '⋯';
      if (status === 'retrying') return '↻';
      return '○';
    }).join(' ');
    
    console.log(`Progress [${progressBar}] - ${completed}/${totalChunks} completed, ${failed} failed, ${retrying} retrying, ${inProgress} in progress`);
  };
  
  // Process each chunk in parallel
  for (let i = 0; i < chunks.length; i++) {
    const processChunk = async () => {
      try {
        // Initial attempt
        chunkStatus[i] = 'in-progress';
        updateProgress();
        
        // Try to process the chunk with retries
        const chunkResult = await processChunkWithRetry(
          chunks[i], 
          focusAreas, 
          timeout, 
          apiKey, 
          i+1, 
          totalChunks,
          (status) => {
            chunkStatus[i] = status;
            updateProgress();
          }
        );
        
        chunkResults.push(chunkResult);
        chunkStatus[i] = 'completed';
        updateProgress();
        return chunkResult;
      } catch (error) {
        console.error(`Error processing chunk ${i+1}: ${error.message}`);
        errors.push({
          chunkNumber: i+1,
          error: error.message,
          code: chunks[i].substring(0, 100) + '...' // First 100 chars for context
        });
        chunkStatus[i] = 'failed';
        updateProgress();
        return null;
      }
    };
    
    chunkPromises.push(processChunk());
  }
  
  // Wait for all chunks to be processed
  await Promise.all(chunkPromises);
  
  // If all chunks failed, throw an error
  if (chunkResults.length === 0 && errors.length > 0) {
    const errorMessage = `All ${errors.length} chunks failed to process. First error: ${errors[0].error}`;
    throw new Error(errorMessage);
  }
  
  // Combine results from all chunks
  const combinedResults = combineChunkResults(chunkResults, focusAreas);
  
  // Add error information if some chunks failed
  if (errors.length > 0) {
    combinedResults.errors = errors;
    combinedResults.partialSuccess = true;
    combinedResults.summary = `⚠️ Note: ${errors.length} of ${totalChunks} chunks failed to process. The review is incomplete.\n\n` + combinedResults.summary;
  }
  
  // Format the output for better readability
  enhanceOutputFormat(combinedResults);
  
  return combinedResults;
}

/**
 * Process a chunk with automatic retry and exponential backoff
 * @param {string} codeChunk - Code chunk to review
 * @param {string[]} focusAreas - Focus areas for the review
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} apiKey - DeepSeek API key
 * @param {number} chunkNumber - Current chunk number
 * @param {number} totalChunks - Total number of chunks
 * @param {Function} updateStatus - Function to update chunk status
 * @returns {Promise<Object>} - Review results for this chunk
 */
async function processChunkWithRetry(codeChunk, focusAreas, timeout, apiKey, chunkNumber, totalChunks, updateStatus) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 1000; // Start with 1 second delay
  const MAX_DELAY = 10000; // Maximum delay of 10 seconds
  
  let lastError;
  let retryAttempts = 0;
  
  // Try up to MAX_RETRIES times
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // If this is a retry, update the status and log
      if (attempt > 0) {
        retryAttempts = attempt;
        console.log(`Retry attempt ${attempt}/${MAX_RETRIES} for chunk ${chunkNumber}...`);
        updateStatus('retrying');
      }
      
      // Process the chunk
      const result = await reviewCodeChunk(codeChunk, focusAreas, timeout, apiKey, chunkNumber, totalChunks);
      
      // If we had retries, add that information to the result
      if (retryAttempts > 0) {
        result.retryAttempts = retryAttempts;
        result.retrySuccess = true;
      }
      
      return result;
      
    } catch (error) {
      lastError = error;
      
      // If we've reached max retries, throw the error
      if (attempt === MAX_RETRIES) {
        // Add retry information to the error
        error.retryAttempts = MAX_RETRIES;
        error.retrySuccess = false;
        throw error;
      }
      
      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = Math.min(
        MAX_DELAY,
        BASE_DELAY * Math.pow(2, attempt)
      );
      
      // Add jitter (±20% randomness)
      const jitter = 0.2 * exponentialDelay * (Math.random() - 0.5);
      const delayWithJitter = Math.max(100, exponentialDelay + jitter);
      
      // Log more detailed error information
      const errorType = error.name || 'Error';
      console.log(`Chunk ${chunkNumber} failed (${errorType}): ${error.message}. Retrying in ${Math.round(delayWithJitter/1000)} seconds...`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayWithJitter));
    }
  }
  
  // This should never be reached due to the throw in the loop,
  // but TypeScript might complain without it
  throw lastError;
}

/**
 * Enhances the output format for better readability
 * @param {Object} results - Review results to enhance
 */
function enhanceOutputFormat(results) {
  // Add a quick summary section at the top
  const issueCount = results.issueCount || {
    critical: results.issues?.critical?.length || 0,
    high: results.issues?.high?.length || 0,
    medium: results.issues?.medium?.length || 0,
    low: results.issues?.low?.length || 0
  };
  
  const totalIssues = issueCount.critical + issueCount.high + issueCount.medium + issueCount.low;
  
  // Count successful retries
  let retrySuccessCount = 0;
  if (results.chunkResults) {
    retrySuccessCount = results.chunkResults.filter(chunk => chunk && chunk.retrySuccess).length;
  }
  
  // Create a quick stats summary
  const quickStats = `
## Quick Stats
- **Total Issues**: ${totalIssues}
- **Critical**: ${issueCount.critical}
- **High**: ${issueCount.high}
- **Medium**: ${issueCount.medium}
- **Low**: ${issueCount.low}
- **Focus Areas**: ${results.focusAreas.join(', ')}
- **Chunks Processed**: ${results.processedChunks || 1}/${results.totalChunks || 1}
${retrySuccessCount > 0 ? `- **Chunks Recovered**: ${retrySuccessCount} (via retry mechanism)` : ''}
`;
  
  // Create a key issues section that highlights critical and high issues
  let keyIssues = '';
  
  if (issueCount.critical > 0 || issueCount.high > 0) {
    keyIssues = `
## Key Issues to Address

${issueCount.critical > 0 ? `### Critical Issues
${results.issues.critical.map((issue, i) => `${i+1}. ${issue}`).join('\n')}
` : ''}

${issueCount.high > 0 ? `### High Priority Issues
${results.issues.high.map((issue, i) => `${i+1}. ${issue}`).join('\n')}
` : ''}
`;
  }
  
  // Combine all sections
  results.summary = quickStats + keyIssues + '\n**\n\n' + results.summary;
  
  // Add retry information to the summary if applicable
  if (retrySuccessCount > 0) {
    results.summary += `\n\n**Note:** ${retrySuccessCount} chunk(s) initially failed but were successfully recovered through the automatic retry mechanism.`;
  }
  
  return results;
}

/**
 * Reviews a single chunk of code
 * @param {string} codeChunk - Code chunk to review
 * @param {string[]} focusAreas - Focus areas for the review
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} apiKey - DeepSeek API key
 * @param {number} chunkNumber - Current chunk number
 * @param {number} totalChunks - Total number of chunks
 * @returns {Promise<Object>} - Review results for this chunk
 */
async function reviewCodeChunk(codeChunk, focusAreas, timeout, apiKey, chunkNumber, totalChunks) {
  // Construct a simpler prompt based on focus areas
  const prompt = constructSimplifiedPrompt(codeChunk, focusAreas, chunkNumber, totalChunks);

  // Create a promise that rejects after the timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new DeepseekTimeoutError(`DeepSeek API request timed out for chunk ${chunkNumber}`, chunkNumber)), timeout);
  });

  // Create the API request promise
  const requestPromise = fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are an expert code reviewer. Be concise and focus on important issues.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 2048
    })
  })
  .then(response => {
    if (!response.ok) {
      return response.text().then(text => {
        try {
          // Try to parse the error as JSON for more details
          const errorData = JSON.parse(text);
          throw new DeepseekApiError(`DeepSeek API error: ${response.status} - ${errorData.error?.message || errorData.error || text}`, response.status);
        } catch (e) {
          // If parsing fails, use the raw text
          throw new DeepseekApiError(`DeepSeek API error: ${response.status} ${response.statusText} - ${text}`, response.status);
        }
      });
    }
    return response.json();
  })
  .then(data => {
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new DeepseekParsingError('Invalid response from DeepSeek API');
    }
    
    const review = data.choices[0].message.content;
    return parseReviewResponse(review, focusAreas, chunkNumber, totalChunks);
  });

  // Race the request against the timeout
  try {
    return await Promise.race([requestPromise, timeoutPromise]);
  } catch (error) {
    if (error instanceof DeepseekTimeoutError) {
      throw error;
    }
    throw error;
  }
}

/**
 * Splits code into smaller chunks for processing
 * @param {string} code - Full code to split
 * @param {number} chunkSize - Approximate size of each chunk in characters
 * @returns {string[]} - Array of code chunks
 */
function splitCodeIntoChunks(code, chunkSize) {
  // If code is small enough, return as single chunk
  if (code.length <= chunkSize) {
    return [code];
  }
  
  // Split by lines first
  const lines = code.split('\n');
  const chunks = [];
  let currentChunk = '';
  
  for (const line of lines) {
    // If adding this line would exceed chunk size and we already have content,
    // start a new chunk
    if (currentChunk.length + line.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = line + '\n';
    } else {
      currentChunk += line + '\n';
    }
  }
  
  // Add the last chunk if it has content
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Constructs a simplified prompt for the DeepSeek API
 * @param {string} code - Code content to review
 * @param {string[]} focusAreas - Focus areas for the review
 * @param {number} chunkNumber - Current chunk number
 * @param {number} totalChunks - Total number of chunks
 * @returns {string} - Constructed prompt
 */
function constructSimplifiedPrompt(code, focusAreas, chunkNumber, totalChunks) {
  let focusInstructions = '';
  
  if (focusAreas.includes('security')) {
    focusInstructions += 'security, ';
  }
  
  if (focusAreas.includes('performance')) {
    focusInstructions += 'performance, ';
  }
  
  if (focusAreas.includes('readability')) {
    focusInstructions += 'readability, ';
  }
  
  if (focusAreas.includes('maintainability')) {
    focusInstructions += 'maintainability, ';
  }

  // Remove trailing comma and space
  focusInstructions = focusInstructions.replace(/, $/, '');
  
  // If no specific focus areas, use general
  if (focusInstructions === '') {
    focusInstructions = 'general code quality';
  }

  return `Review this code (chunk ${chunkNumber}/${totalChunks}) focusing on ${focusInstructions}.
Provide a brief summary, list issues by severity (Critical/High/Medium/Low), and suggest improvements.

CODE:
\`\`\`
${code}
\`\`\``;
}

/**
 * Parses the review response from DeepSeek
 * @param {string} reviewText - Raw review text from DeepSeek
 * @param {string[]} focusAreas - Focus areas that were requested
 * @param {number} chunkNumber - Current chunk number
 * @param {number} totalChunks - Total number of chunks
 * @returns {Object} - Structured review data
 */
function parseReviewResponse(reviewText, focusAreas, chunkNumber, totalChunks) {
  // Simple parsing logic - can be enhanced for more structured extraction
  const sections = {
    summary: extractSection(reviewText, 'Summary', 'Issues'),
    issues: extractSection(reviewText, 'Issues', 'Recommendations'),
    recommendations: extractSection(reviewText, 'Recommendations', 'Strengths'),
    strengths: extractSection(reviewText, 'Strengths', null)
  };

  // Extract issues by severity
  const issues = {
    critical: extractIssuesBySeverity(sections.issues, 'Critical'),
    high: extractIssuesBySeverity(sections.issues, 'High'),
    medium: extractIssuesBySeverity(sections.issues, 'Medium'),
    low: extractIssuesBySeverity(sections.issues, 'Low')
  };

  return {
    model: 'deepseek-chat',
    focusAreas,
    summary: sections.summary || reviewText, // Use full text if no summary section found
    issues,
    recommendations: sections.recommendations,
    strengths: sections.strengths,
    rawResponse: reviewText,
    chunkNumber,
    totalChunks
  };
}

/**
 * Combines results from multiple chunks into a single review
 * @param {Object[]} chunkResults - Results from individual chunks
 * @param {string[]} focusAreas - Focus areas that were requested
 * @returns {Object} - Combined review data
 */
function combineChunkResults(chunkResults, focusAreas) {
  // Initialize combined results
  const combinedResults = {
    summary: '',
    issues: {
      critical: [],
      high: [],
      medium: [],
      low: []
    },
    recommendations: [],
    strengths: [],
    focusAreas,
    processedChunks: chunkResults.length,
    totalChunks: chunkResults.length,
    chunkResults: chunkResults // Store the original chunk results for retry tracking
  };
  
  if (chunkResults.length === 0) {
    throw new Error('No chunk results to combine');
  }
  
  if (chunkResults.length === 1) {
    return chunkResults[0]; // Return as is if only one chunk
  }
  
  // Combine summaries into a more cohesive format
  const summaries = chunkResults.map((result, index) => {
    const summary = result.summary || 'No summary available';
    return `Chunk ${index+1}: ${summary}`;
  });
  
  // Create a unified summary that highlights key points
  const combinedSummary = `Code Review Summary (${chunkResults.length} chunks):\n\n${summaries.join('\n\n')}`;
  
  // Combine issues by severity with deduplication
  const combinedIssues = {
    critical: [],
    high: [],
    medium: [],
    low: []
  };
  
  // Set to track unique issues and avoid duplicates
  const uniqueIssues = new Set();
  
  for (const result of chunkResults) {
    if (result.issues) {
      for (const severity of ['critical', 'high', 'medium', 'low']) {
        if (result.issues[severity] && Array.isArray(result.issues[severity])) {
          // Add each issue if it's not a duplicate
          for (const issue of result.issues[severity]) {
            // Create a normalized version of the issue for deduplication
            const normalizedIssue = issue.toLowerCase().trim();
            if (!uniqueIssues.has(normalizedIssue)) {
              uniqueIssues.add(normalizedIssue);
              combinedIssues[severity].push(issue);
            }
          }
        }
      }
    }
  }
  
  // Combine recommendations with better formatting and deduplication
  const uniqueRecommendations = new Set();
  const formattedRecommendations = [];
  
  for (const result of chunkResults) {
    if (result.recommendations) {
      // Split recommendations into individual items
      const recommendations = result.recommendations
        .split(/\n+/)
        .map(rec => rec.trim())
        .filter(rec => rec.length > 0);
      
      for (const rec of recommendations) {
        const normalizedRec = rec.toLowerCase().trim();
        if (!uniqueRecommendations.has(normalizedRec)) {
          uniqueRecommendations.add(normalizedRec);
          formattedRecommendations.push(rec);
        }
      }
    }
  }
  
  const combinedRecommendations = formattedRecommendations.length > 0 
    ? formattedRecommendations.join('\n\n')
    : '';
  
  // Combine strengths with better formatting and deduplication
  const uniqueStrengths = new Set();
  const formattedStrengths = [];
  
  for (const result of chunkResults) {
    if (result.strengths) {
      // Split strengths into individual items
      const strengths = result.strengths
        .split(/\n+/)
        .map(str => str.trim())
        .filter(str => str.length > 0);
      
      for (const str of strengths) {
        const normalizedStr = str.toLowerCase().trim();
        if (!uniqueStrengths.has(normalizedStr)) {
          uniqueStrengths.add(normalizedStr);
          formattedStrengths.push(str);
        }
      }
    }
  }
  
  const combinedStrengths = formattedStrengths.length > 0 
    ? formattedStrengths.join('\n\n')
    : '';
  
  // Count issues by severity for a better overview
  const issueCount = {
    critical: combinedIssues.critical.length,
    high: combinedIssues.high.length,
    medium: combinedIssues.medium.length,
    low: combinedIssues.low.length,
    total: combinedIssues.critical.length + combinedIssues.high.length + 
           combinedIssues.medium.length + combinedIssues.low.length
  };
  
  return {
    model: 'deepseek-chat',
    focusAreas,
    summary: combinedSummary,
    issues: combinedIssues,
    issueCount,
    recommendations: combinedRecommendations,
    strengths: combinedStrengths,
    rawResponse: chunkResults.map(r => r.rawResponse).join('\n\n---\n\n'),
    processedChunks: chunkResults.length,
    totalChunks: chunkResults[0].totalChunks
  };
}

/**
 * Extracts a section from the review text
 * @param {string} text - Full review text
 * @param {string} sectionName - Name of the section to extract
 * @param {string|null} nextSectionName - Name of the next section (or null if last section)
 * @returns {string} - Extracted section text
 */
function extractSection(text, sectionName, nextSectionName) {
  if (!text) return '';
  
  // Find the start of the section - handle variations in formatting
  const sectionRegexes = [
    new RegExp(`\\b${sectionName}\\b[:\\s]*`, 'i'),
    new RegExp(`###\\s*\\b${sectionName}\\b[:\\s]*`, 'i'),
    new RegExp(`##\\s*\\b${sectionName}\\b[:\\s]*`, 'i'),
    new RegExp(`#\\s*\\b${sectionName}\\b[:\\s]*`, 'i')
  ];
  
  let startIndex = -1;
  let matchLength = 0;
  
  for (const regex of sectionRegexes) {
    const match = text.match(regex);
    if (match && (startIndex === -1 || match.index < startIndex)) {
      startIndex = match.index;
      matchLength = match[0].length;
    }
  }
  
  if (startIndex === -1) return '';
  
  startIndex += matchLength;
  
  // Find the end of the section (start of next section or end of text)
  let endIndex = text.length;
  
  if (nextSectionName) {
    const nextSectionRegexes = [
      new RegExp(`\\b${nextSectionName}\\b[:\\s]*`, 'i'),
      new RegExp(`###\\s*\\b${nextSectionName}\\b[:\\s]*`, 'i'),
      new RegExp(`##\\s*\\b${nextSectionName}\\b[:\\s]*`, 'i'),
      new RegExp(`#\\s*\\b${nextSectionName}\\b[:\\s]*`, 'i')
    ];
    
    for (const regex of nextSectionRegexes) {
      const match = text.match(regex);
      if (match && match.index > startIndex && match.index < endIndex) {
        endIndex = match.index;
      }
    }
  }
  
  return text.substring(startIndex, endIndex).trim();
}

/**
 * Extracts issues by severity from the issues section
 * @param {string} issuesText - Text from the issues section
 * @param {string} severity - Severity level to extract (Critical, High, Medium, Low)
 * @returns {string[]} - Array of issues at the specified severity
 */
function extractIssuesBySeverity(issuesText, severity) {
  if (!issuesText) return [];
  
  // Find the severity heading - handle variations in formatting
  const severityRegexes = [
    new RegExp(`\\b${severity}\\b[:\\s]*`, 'i'),
    new RegExp(`###\\s*\\b${severity}\\b[:\\s]*`, 'i'),
    new RegExp(`##\\s*\\b${severity}\\b[:\\s]*`, 'i'),
    new RegExp(`#\\s*\\b${severity}\\b[:\\s]*`, 'i')
  ];
  
  let startIndex = -1;
  let matchLength = 0;
  
  for (const regex of severityRegexes) {
    const match = issuesText.match(regex);
    if (match && (startIndex === -1 || match.index < startIndex)) {
      startIndex = match.index;
      matchLength = match[0].length;
    }
  }
  
  if (startIndex === -1) return [];
  
  startIndex += matchLength;
  
  // Find the end of this severity section (next severity or end of issues)
  const severities = ['Critical', 'High', 'Medium', 'Low'];
  const nextSeverities = severities.filter(s => s.toLowerCase() !== severity.toLowerCase());
  
  let endIndex = issuesText.length;
  
  for (const nextSeverity of nextSeverities) {
    const nextSeverityRegexes = [
      new RegExp(`\\b${nextSeverity}\\b[:\\s]*`, 'i'),
      new RegExp(`###\\s*\\b${nextSeverity}\\b[:\\s]*`, 'i'),
      new RegExp(`##\\s*\\b${nextSeverity}\\b[:\\s]*`, 'i'),
      new RegExp(`#\\s*\\b${nextSeverity}\\b[:\\s]*`, 'i')
    ];
    
    for (const regex of nextSeverityRegexes) {
      const match = issuesText.match(regex);
      if (match && match.index > startIndex && match.index < endIndex) {
        endIndex = match.index;
      }
    }
  }
  
  const severityText = issuesText.substring(startIndex, endIndex).trim();
  
  // Split into individual issues (handling various list formats)
  const issues = [];
  
  // Handle numbered lists (1. Issue description)
  const numberedMatches = severityText.match(/\d+\.\s+.+?(?=\n\d+\.|\n\s*$|$)/gs);
  if (numberedMatches) {
    issues.push(...numberedMatches.map(issue => issue.trim()));
  } else {
    // Handle bullet points and other list formats
    issues.push(
      ...severityText
        .split(/\n\s*[-*•]\s*|\n\s*\d+\.\s+/)
        .filter(issue => issue.trim() !== '')
        .map(issue => issue.trim())
    );
  }
  
  return issues;
}
