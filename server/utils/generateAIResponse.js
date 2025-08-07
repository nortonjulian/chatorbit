import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateAIResponse(userMessage) {
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'I am OrbitBot, a friendly chat companion.' },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 100,
    });
    return response.choices[0]?.message?.content || "I'm here to chat!";
  } catch (err) {
    console.error('AI Error:', err);
    return "Oops, I couldn't respond right now.";
  }
}
