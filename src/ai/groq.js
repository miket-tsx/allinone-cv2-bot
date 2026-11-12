// Minimal Groq client. Their API is OpenAI-compatible, so plain fetch is all we need.
const { UserError } = require('../lib/util');

const URL = 'https://api.groq.com/openai/v1/chat/completions';
// Groq sits behind Cloudflare, which rejects requests whose headers look like a script
// (error 1010) -- Node's fetch sends "User-Agent: node" and gets blocked before the API
// ever sees the key. A normal browser-ish UA keeps us out of that bucket.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json',
};
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Groq puts the useful bit of an error in {"error":{"message":"..."}}
function reason(detail) {
  const text = String(detail || '').trim();
  try {
    return JSON.parse(text).error?.message || text;
  } catch {
    return text;
  }
}

async function chat(body, { attempts = 3 } = {}) {
  const key = process.env.GROQ_API_KEY;
  if (!key)
    throw new UserError("My AI brain isn't plugged in yet. The bot owner needs to add GROQ_API_KEY to .env.");

  const model = body.model || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  for (let i = 1; i <= attempts; i++) {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { ...HEADERS, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        ...body,
      }),
      signal: AbortSignal.timeout(45000),
    }).catch((e) => ({ ok: false, status: 0, text: async () => e.message, headers: new Map() }));

    if (res.ok) return (await res.json()).choices[0].message;

    const detail = await res.text();
    // Free tier is 30 requests a minute; waiting a few seconds is usually enough
    if (res.status === 429 && i < attempts) {
      const wait = Number(res.headers.get?.('retry-after')) || 4 * i;
      await sleep(Math.min(wait, 20) * 1000);
      continue;
    }
    // Models occasionally write a malformed tool call; a second try almost always fixes it
    if (res.status === 400 && detail.includes('tool_use_failed') && i < attempts) continue;
    if (res.status >= 500 && i < attempts) {
      await sleep(1500 * i);
      continue;
    }
    console.error(`[groq] ${res.status} ${model}: ${detail.slice(0, 500)}`);
    const why = reason(detail).slice(0, 200);
    if (res.status === 0)
      throw new UserError(`I couldn't reach Groq from the bot host (${why}). Check the machine's internet, then try again.`);
    if (res.status === 401)
      throw new UserError('Groq rejected the API key. The bot owner should check GROQ_API_KEY.');
    if (res.status === 403)
      throw new UserError(
        'Groq blocked the request (403). Usually that means GROQ_API_KEY is wrong, or the host is blocked from reaching Groq.',
      );
    if (res.status === 404 || why.includes('does not exist') || why.includes('model_not_found'))
      throw new UserError(
        `The Groq model "${model}" isn't available on this key. The bot owner can pick another one in .env (GROQ_MODEL, GROQ_ROUTER_MODEL, GROQ_VISION_MODEL or GROQ_GUARD_MODEL).`,
      );
    if (res.status === 429)
      throw new UserError("I'm getting rate limited by Groq. Give me a minute and ask again.");
    if (res.status === 413)
      throw new UserError('That request was too big for Groq. Try a shorter message or fewer images.');
    throw new UserError(`Groq didn't play nice just now (${res.status}: ${why}). Try again in a moment.`);
  }
}

module.exports = { chat };
