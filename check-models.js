import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;

async function checkModels() {
  try {
    const response = await fetch('https://api.deepseek.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      return;
    }

    const data = await response.json();
    console.log('Available DeepSeek Models:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error checking models:', error);
  }
}

checkModels();
