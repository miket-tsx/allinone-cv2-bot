// Opt-in AI moderation with a safety model on Groq. It reads messages in the chosen channels and
// either flags them in the mod log or deletes them, depending on the server's setting.
// It's a second pair of eyes, not a replacement for real mods: it makes mistakes both ways.
const { chat } = require('./groq');
const db = require('../lib/db');
const { sendLog } = require('../lib/log');
const { card, C, trunc } = require('../lib/ui');

const MODEL = () => process.env.GROQ_GUARD_MODEL || 'openai/gpt-oss-safeguard-20b';
const PER_MINUTE = 20; // per server, so a busy server can't burn through the Groq quota

const CATEGORIES = {
  S1: 'Violent crimes',
  S2: 'Non-violent crimes',
  S3: 'Sex-related crimes',
  S4: 'Child sexual exploitation',
  S5: 'Defamation',
  S6: 'Specialized advice',
  S7: 'Privacy',
  S8: 'Intellectual property',
  S9: 'Indiscriminate weapons',
  S10: 'Hate',
  S11: 'Suicide and self-harm',
  S12: 'Sexual content',
  S13: 'Elections',
  S14: 'Code interpreter abuse',
};
// These are noisy in normal chat ("I'm gonna kill this boss"), so they're ignored unless asked for
const DEFAULT_IGNORE = ['S5', 'S6', 'S7', 'S8', 'S13', 'S14'];

const budget = new Map(); // guildId -> [timestamps]

// The model answers "safe", or "unsafe" with the category codes on the next line
function parse(reply) {
  const text = String(reply || '').trim().toLowerCase();
  if (!text.startsWith('unsafe')) return { safe: true, codes: [] };
  const codes = [...new Set((text.match(/s\d{1,2}/g) || []).map((c) => c.toUpperCase()))];
  return { safe: false, codes };
}

// Guard models that don't have the taxonomy baked in (GPT-OSS Safeguard) need to be told
// which codes to use. Llama Guard ignores the system prompt and does its own thing.
const TAXONOMY = Object.entries(CATEGORIES)
  .map(([code, name]) => `${code} ${name}`)
  .join(', ');
const SYSTEM =
  'You are a content safety classifier for a Discord server. Read the user message and answer with ' +
  'exactly "safe", or with "unsafe" on one line and the matching category codes on the next line, ' +
  `comma separated. No other words. Categories: ${TAXONOMY}.`;

async function classify(content) {
  const reply = await chat(
    {
      model: MODEL(),
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: trunc(content, 4000) },
      ],
    },
    { attempts: 1 },
  );
  return parse(reply.content);
}

function shouldCheck(message) {
  const cfg = db.guild(message.guild.id).ai.moderation;
  if (!cfg.enabled || !process.env.GROQ_API_KEY) return false;
  if ((message.content || '').length < 6) return false;
  if (cfg.channels.length && !cfg.channels.includes(message.channel.id) && !cfg.channels.includes(message.channel.parentId)) return false;
  if (message.member?.permissions.has('ManageMessages')) return false;
  const now = Date.now();
  const list = (budget.get(message.guild.id) || []).filter((t) => now - t < 60_000);
  if (list.length >= PER_MINUTE) return false;
  list.push(now);
  budget.set(message.guild.id, list);
  return true;
}

async function moderate(message) {
  if (!shouldCheck(message)) return;
  const cfg = db.guild(message.guild.id).ai.moderation;
  const result = await classify(message.content).catch(() => null);
  if (!result || result.safe) return;
  const ignore = cfg.ignore || DEFAULT_IGNORE;
  const codes = result.codes.filter((c) => !ignore.includes(c));
  if (!codes.length) return;
  const labels = codes.map((c) => `${CATEGORIES[c] || c} (${c})`).join(', ');
  let action = 'Flagged for review';
  if (cfg.action === 'delete') {
    const gone = await message.delete().then(() => true).catch(() => false);
    if (gone) {
      action = 'Message deleted';
      message.channel
        .send({ ...card({ description: `⚠️ <@${message.author.id}>, a message of yours was removed by AI moderation. If that was a mistake, a mod can sort it out.`, color: C.warn }), allowedMentions: { users: [message.author.id] } })
        .then((m) => setTimeout(() => m.delete().catch(() => {}), 10_000))
        .catch(() => {});
    }
  }
  sendLog(message.guild, {
    title: '🤖 AI moderation',
    color: C.mod,
    description: trunc(message.content, 800),
    fields: [
      ['Member', `<@${message.author.id}> (${message.author.username})`],
      ['Channel', `<#${message.channel.id}>`],
      ['Category', labels],
      ['Action', action],
      ['Jump', cfg.action === 'delete' ? null : `[message](${message.url})`],
    ],
    footer: 'AI moderation can be wrong. Double-check before punishing anyone.',
  });
}

module.exports = { moderate, classify, parse, CATEGORIES, DEFAULT_IGNORE };
