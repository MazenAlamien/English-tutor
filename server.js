import express from 'express';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '50kb' }));
app.use(express.static('public'));

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || 'claude-sonnet-5-5';
const CODE = process.env.ACCESS_CODE || '';

// simple rate limit: 20 requests per minute per IP
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const a = (hits.get(ip) || []).filter(t => now - t < 60000);
  a.push(now);
  hits.set(ip, a);
  return a.length > 20;
}

const rules = level =>
  `You are a friendly English tutor for an Arabic-speaking learner. Level: ${level}. ` +
  `Reply in exactly this format: <short spoken English reply, max 2 sentences, ending with one question> ` +
  `||| <if the learner's last message had mistakes: the corrected sentence in English, then a brief explanation in Arabic; ` +
  `otherwise: ممتاز! plus one short Arabic tip>. Use simple words for the level. Output nothing else.`;

app.post('/api/chat', async (req, res) => {
  if (CODE && req.get('x-access-code') !== CODE) return res.sendStatus(401);
  if (limited(req.ip)) return res.status(429).json({ error: 'slow down' });

  const { messages, level } = req.body || {};
  const valid =
    Array.isArray(messages) && messages.length > 0 && messages.length <= 12 &&
    messages[0].role === 'user' &&
    messages.every(m => ['user', 'assistant'].includes(m.role) &&
      typeof m.content === 'string' && m.content.length < 1500);
  if (!valid) return res.sendStatus(400);
  const lv = ['beginner', 'intermediate', 'advanced'].includes(level) ? level : 'intermediate';

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, system: rules(lv), messages })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('Anthropic error', r.status, JSON.stringify(data));
      return res.status(502).json({ error: 'upstream' });
    }
    res.json({ text: (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('') });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Running on port ' + port));
