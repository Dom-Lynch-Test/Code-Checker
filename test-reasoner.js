import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;

async function testDeepseekReasoner() {
  try {
    console.log('Testing DeepSeek Reasoner API with key:', apiKey);
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-reasoner',
        messages: [
          {
            role: 'user',
            content: 'What is 2+2?'
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
    console.log('DeepSeek Reasoner API Response:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error testing DeepSeek Reasoner API:', error);
  }
}

testDeepseekReasoner();
