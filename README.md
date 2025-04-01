# AI Code Review

A standalone AI code review tool that leverages the DeepSeek V3-0324 model to provide comprehensive code analysis and improvement suggestions.

## Features

- **Advanced AI Analysis**: Utilizes DeepSeek's powerful model for in-depth code feedback
- **Focus Areas**: Target specific aspects like security, performance, readability, or maintainability
- **Multiple Output Formats**: Get results in plain text, JSON, or markdown
- **Timeout Handling**: Prevent indefinite hanging with configurable timeouts
- **Progress Reporting**: Real-time feedback with spinner animation
- **Comprehensive Error Handling**: Graceful handling of API failures with retry mechanism

## Installation

### Global Installation

```bash
npm install -g ai-code-review
```

### Local Installation

```bash
npm install ai-code-review
```

## Configuration

The tool requires an API key for the DeepSeek model. You can provide this in several ways:

### Environment Variables

Create a `.env` file in your project root with:

```
# Required for DeepSeek API
NEXT_PUBLIC_DEEPSEEK_API_KEY=your-deepseek-api-key
```

### Configuration File

Alternatively, create a `.aicodereviewrc` file in your project root:

```json
{
  "NEXT_PUBLIC_DEEPSEEK_API_KEY": "your-deepseek-api-key"
}
```

## Usage

### Command Line

Review a file:

```bash
ai-code-review --file path/to/file.js
```

Review a code snippet:

```bash
ai-code-review --code "function example() { return 'test'; }"
```

Focus on specific areas:

```bash
ai-code-review --file path/to/file.js --focus "security,performance"
```

Control timeout:

```bash
ai-code-review --file path/to/file.js --timeout 30
```

Change output format:

```bash
ai-code-review --file path/to/file.js --output markdown
```

Enable verbose logging:

```bash
ai-code-review --file path/to/file.js --verbose
```

### Programmatic Usage

```javascript
import { reviewCode } from 'ai-code-review';

async function runReview() {
  const results = await reviewCode({
    filePath: 'path/to/file.js',
    focusAreas: ['security', 'performance'],
    timeout: 30000,
    outputFormat: 'json'
  });
  
  console.log(results);
}

runReview();
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--file` | Path to the file to review | - |
| `--code` | Code snippet to review (as a string) | - |
| `--focus` | Focus areas (comma-separated) | "general" |
| `--timeout` | Timeout for DeepSeek API in seconds | 60 |
| `--output` | Output format (text, json, markdown) | "text" |
| `--verbose` | Enable verbose output | false |

## AI Model

### DeepSeek

- **Model**: DeepSeek V3-0324
- **Configuration**: Temperature 0.2, Max Tokens 4096

## License

MIT
