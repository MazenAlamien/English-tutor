import express from 'express';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '50kb' }));
app.use(express.static('.'));

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
  return `You are a friendly English tutor for an Arabic-speaking learner. Level: ${level}. ` +
    `Reply in exactly this format: <short spoken English reply, max 2 sentences, ending with one question> ` +
    `||| <if the learner's last message had mistakes: the corrected sentence in English, then a brief explanation in Arabic; ` +
    `otherwise: ممتاز! plus one short Arabic tip>. Use simple words for the level. Output nothing else.`;
};

app.post('/api/chat', async (req, res) => {
  if (CODE && req.get('x-access-code') !== CODE) return res.sendStatus(401);
  if (limited(req.ip)) return res.status(429).json({ error: 'slow down' });

  const { messages, level, mode } = req.body || {};
  const valid =
    Array.isArray(messages) && messages.length > 0 && messages.length <= 12 &&
    messages[0].role === 'user' &&
    messages.every(m => ['user', 'assistant'].includes(m.role) &&
      typeof m.content === 'string' && m.content.length < 1500);
  if (!valid) return res.sendStatus(400);
  const lv = ['beginner', 'intermediate', 'advanced'].includes(level) ? level : 'intermediate';
  const md = ['learn', 'translate', 'arabic'].includes(mode) ? mode : 'learn';

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 500, system: rules(md, lv), messages })
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

// ---- natural voice: ElevenLabs (optional; without a key the page uses the browser voice) ----
// One multilingual voice reads both English and Arabic; the model detects the language from the text.
const EL_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
const TTS_MODEL = process.env.TTS_MODEL || 'eleven_flash_v2_5';

app.post('/api/tts', async (req, res) => {
  if (CODE && req.get('x-access-code') !== CODE) return res.sendStatus(401);
  if (!EL_KEY || !/^[A-Za-z0-9]+$/.test(VOICE)) return res.sendStatus(501);
  if (limited(req.ip)) return res.status(429).json({ error: 'slow down' });

  const t = String((req.body || {}).text || '').slice(0, 400);
  if (!t.trim()) return res.sendStatus(400);

  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_64`,
      {
        method: 'POST',
        headers: { 'xi-api-key': EL_KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text: t, model_id: TTS_MODEL })
      }
    );
    if (!r.ok) {
      console.error('ElevenLabs error', r.status, (await r.text()).slice(0, 300));
      return res.sendStatus(502);
    }
    res.set('content-type', 'audio/mpeg');
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Running on port ' + port));
