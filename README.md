# AutoBrain 🏍️

A Telegram bot that diagnoses Indian two-wheeler issues using RAG (Retrieval Augmented Generation). Describe a symptom, get ranked causes, repair costs in INR, urgency rating, questions to ask your mechanic, and red flags for scams — all tuned for Indian roads, BS6 engines, and monsoon conditions.

## How It Works

1. **Indexing** (`index-brain.js`) — Run once. Reads all `.md` files from `/brain`, embeds each chunk using Cohere, and stores vectors in Supabase.
2. **Bot** (`bot.js`) — On each Telegram message, embeds the query, finds the top 3 most relevant knowledge chunks from Supabase, and sends them with the question to Claude for a diagnosis.

## Stack

| Component | Technology |
|-----------|-----------|
| Bot framework | `node-telegram-bot-api` |
| Embeddings | Cohere `embed-english-v3.0` (1024 dims) |
| Vector DB | Supabase pgvector |
| LLM | Anthropic Claude (`claude-sonnet-4-20250514`) |
| Runtime | Node.js 18+ |

## Setup

### 1. Clone and install

```bash
git clone https://github.com/supplychainengineer/auto-brain
cd auto-brain
npm install
```

### 2. Create a Telegram bot

Talk to [@BotFather](https://t.me/BotFather) on Telegram → `/newbot` → copy the token.

### 3. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase-setup.sql` to create the `documents` table and `match_documents` function

### 4. Get API keys

| Key | Where to get it |
|-----|----------------|
| `TELEGRAM_TOKEN` | [@BotFather](https://t.me/BotFather) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `COHERE_API_KEY` | [dashboard.cohere.com](https://dashboard.cohere.com) (free tier works) |
| `SUPABASE_URL` | Supabase project → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase project → Settings → API |

### 5. Configure environment

```bash
cp .env.example .env
# Fill in all five values
```

### 6. Index the knowledge base

```bash
npm run index
```

This reads all `.md` files from `/brain`, embeds them in chunks, and stores them in Supabase. Run this once, or again whenever you update the brain files.

### 7. Start the bot

```bash
npm start
```

## Adding Knowledge

Add `.md` files to the `/brain` folder and re-run `npm run index`. The bot will automatically pick up the new content. Current knowledge base covers:

- Engine issues (hard starting, overheating, knocking, smoke)
- Brakes and suspension
- Electrical faults (battery, lighting, ABS, check engine)
- Monsoon maintenance and waterlogging
- Mechanic scams and how to avoid them

## Deployment on Render

1. Push to GitHub
2. Create a new **Background Worker** on [render.com](https://render.com)
3. Connect your repo, set **Build Command** to `npm install` and **Start Command** to `npm start`
4. Add the five environment variables in the Render dashboard

The `render.yaml` in this repo pre-configures the service type and env var names.

## Project Structure

```
auto-brain/
├── bot.js              # Telegram bot (retrieval + Claude response)
├── index-brain.js      # One-time indexing script
├── brain/              # Knowledge base .md files
│   ├── engine-issues.md
│   ├── brakes-suspension.md
│   ├── electrical-issues.md
│   ├── monsoon-maintenance.md
│   └── mechanic-scams.md
├── supabase-setup.sql  # pgvector schema + match_documents function
├── render.yaml         # Render deployment config
└── .env.example        # Environment variable template
```
