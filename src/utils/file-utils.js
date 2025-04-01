import fs from 'fs/promises';
import path from 'path';

/**
 * Reads the content of a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - File content
 */
export async function readFileContent(filePath) {
  try {
    // Resolve the absolute path
    const absolutePath = path.resolve(process.cwd(), filePath);
    
    // Check if file exists
    await fs.access(absolutePath);
    
    // Read the file content
    const content = await fs.readFile(absolutePath, 'utf8');
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    throw new Error(`Error reading file ${filePath}: ${error.message}`);
  }
}

/**
 * Detects the language of a file based on its extension
 * @param {string} filePath - Path to the file
 * @returns {string} - Detected language
 */
export function detectLanguage(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  
  const languageMap = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.rb': 'ruby',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cs': 'csharp',
    '.go': 'go',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.rs': 'rust',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.json': 'json',
    '.md': 'markdown',
    '.sh': 'bash',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.xml': 'xml',
    '.sql': 'sql'
  };
  
  return languageMap[extension] || 'plaintext';
}

/**
 * Gets basic information about a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object>} - File information
 */
export async function getFileInfo(filePath) {
  try {
    const absolutePath = path.resolve(process.cwd(), filePath);
    const stats = await fs.stat(absolutePath);
    
    return {
      path: filePath,
      absolutePath,
      size: stats.size,
      lastModified: stats.mtime,
      language: detectLanguage(filePath)
    };
  } catch (error) {
    throw new Error(`Error getting file info for ${filePath}: ${error.message}`);
  }
}
