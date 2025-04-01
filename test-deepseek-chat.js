import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;

async function testDeepseekChat() {
  try {
    console.log('Testing DeepSeek Chat API...');
    console.log('API Key available:', apiKey ? 'Yes' : 'No');
    
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
            content: 'Hello, can you review this simple function? function add(a, b) { return a + b; }'
          }
        ],
        temperature: 0.2,
        max_tokens: 100
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      return;
    }

    const data = await response.json();
    console.log('DeepSeek Chat API Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\nResponse content:');
    console.log(data.choices[0].message.content);
  } catch (error) {
    console.error('Error testing DeepSeek Chat API:', error);
  }
}

testDeepseekChat();
