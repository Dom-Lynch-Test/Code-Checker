import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;

async function testDeepseek() {
  try {
    console.log('Testing DeepSeek API with key:', apiKey);
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: 'Say hello'
          }
        ],
        max_tokens: 100
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      return;
    }

    const data = await response.json();
    console.log('DeepSeek API Response:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error testing DeepSeek API:', error);
  }
}

testDeepseek();
