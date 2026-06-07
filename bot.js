require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const Anthropic = require('@anthropic-ai/sdk');
const { VoyageAIClient } = require('voyageai');
const { createClient } = require('@supabase/supabase-js');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const SYSTEM_PROMPT = `You are AutoBrain, an expert diagnostic agent for Indian two-wheelers. Use the provided knowledge base to diagnose issues. Give: ranked causes, INR cost, urgency, 3 questions to ask mechanic, red flags for scams. Be specific to Indian context — BS6, monsoon, dusty roads.`;

const TOP_K = 3;

async function embedQuery(text) {
  const response = await voyage.embed({
    model: 'voyage-3',
    input: [text],
  });
  return response.data[0].embedding;
}

async function searchDocuments(embedding) {
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_count: TOP_K,
  });

  if (error) throw new Error(`Supabase search failed: ${error.message}`);
  return data || [];
}

async function askClaude(userQuery, chunks) {
  const context = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n');

  const userMessage = `Knowledge base:\n${context}\n\nUser question: ${userQuery}`;

  const stream = await anthropic.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const message = await stream.finalMessage();
  return message.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) {
    if (text === '/start') {
      await bot.sendMessage(chatId,
        'Welcome to AutoBrain! 🏍️\n\nDescribe your two-wheeler issue and I\'ll help diagnose it.\n\nExample: "My bike vibrates heavily above 60 kmph"\n\nI\'m trained on Indian road conditions, BS6 engines, and common mechanic scams.'
      );
    }
    return;
  }

  let typingInterval;
  try {
    await bot.sendChatAction(chatId, 'typing');
    typingInterval = setInterval(() => bot.sendChatAction(chatId, 'typing'), 4000);

    const embedding = await embedQuery(text);
    const chunks = await searchDocuments(embedding);

    if (chunks.length === 0) {
      clearInterval(typingInterval);
      await bot.sendMessage(chatId, 'Sorry, I couldn\'t find relevant information in my knowledge base for that issue. Please try rephrasing or describe the symptom differently.');
      return;
    }

    const answer = await askClaude(text, chunks);
    clearInterval(typingInterval);

    // Telegram max message length is 4096
    if (answer.length <= 4096) {
      await bot.sendMessage(chatId, answer, { parse_mode: 'Markdown' });
    } else {
      // Split long responses
      const parts = answer.match(/[\s\S]{1,4000}/g) || [answer];
      for (const part of parts) {
        await bot.sendMessage(chatId, part, { parse_mode: 'Markdown' });
      }
    }
  } catch (err) {
    clearInterval(typingInterval);
    console.error('Error handling message:', err);
    await bot.sendMessage(chatId, 'Sorry, something went wrong. Please try again in a moment.');
  }
});

bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});

console.log('AutoBrain bot is running...');
