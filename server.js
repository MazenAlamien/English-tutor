import express from 'express';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '50kb' }));
app.use(express.static('public'));

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || 'claude-sonnet-5-5';
const CODE = process.env.ACCESS_CODE || '';

// simple rate limit: 40 requests per minute per IP (chat + voice)
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const a = (hits.get(ip) || []).filter(t => now - t < 60000);
  a.push(now);
  hits.set(ip, a);
  return a.length > 40;
}

const rules = (mode, level) => {
  if (mode === 'translate') {
    return `You are an interpreter and English coach for an Arabic-speaking learner (level: ${level}). ` +
      `The learner speaks Arabic (sometimes English). Reply in exactly this format: ` +
      `<the natural English translation, one or two sentences> ||| <a short Arabic note: one alternative way to say it, or a pronunciation/usage tip>. ` +
      `Output nothing else.`;
  }
  if (mode === 'arabic') {
    return `You are a friendly Modern Standard Arabic tutor for an English-speaking learner (level: ${level}). ` +
      `Use simple vocabulary for the level. Reply in exactly this format: ` +
      `<short Arabic reply, max 2 sentences, ending with one simple question> ||| <in English: a Latin-letter transliteration, the English meaning, and a gentle correction if the learner made a mistake>. ` +
      `Output nothing else.`;
  }
