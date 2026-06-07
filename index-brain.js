require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { CohereClient } = require('cohere-ai');
const { createClient } = require('@supabase/supabase-js');

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const BRAIN_DIR = path.join(__dirname, 'brain');
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

function chunkText(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end).trim());
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter(c => c.length > 50);
}

async function embedText(text) {
  const response = await cohere.embed({
    model: 'embed-english-v3.0',
    texts: [text],
    inputType: 'search_document',
    embeddingTypes: ['float'],
  });
  return response.embeddings.float[0];
}

async function indexBrain() {
  console.log('Reading .md files from /brain...');

  if (!fs.existsSync(BRAIN_DIR)) {
    console.error('Brain directory not found:', BRAIN_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(BRAIN_DIR).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.error('No .md files found in /brain');
    process.exit(1);
  }

  console.log(`Found ${files.length} files: ${files.join(', ')}`);

  // Clear existing documents
  const { error: deleteError } = await supabase.from('documents').delete().gt('id', 0);
  if (deleteError) console.warn('Warning clearing documents:', deleteError.message);

  let totalChunks = 0;

  for (const file of files) {
    const filePath = path.join(BRAIN_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const chunks = chunkText(content);

    console.log(`\n${file}: ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      process.stdout.write(`  Embedding chunk ${i + 1}/${chunks.length}...`);

      const embedding = await embedText(chunk);

      const { error } = await supabase.from('documents').insert({
        content: chunk,
        embedding,
      });

      if (error) {
        console.error(`\n  Error inserting chunk: ${error.message}`);
      } else {
        process.stdout.write(' done\n');
        totalChunks++;
      }

      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\nIndexing complete. ${totalChunks} chunks stored.`);
}

indexBrain().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
