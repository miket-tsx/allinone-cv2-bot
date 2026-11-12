// The counting channel: 1, 2, 3... One number per person in a row, and a wrong number
// resets the count back to zero. Math like 2*5 counts too, unless the server turned it off.
const db = require('./db');
const { evaluate } = require('./mathparse');
const { isOn } = require('./features');

// What number a message is trying to be, or null when it isn't a counting attempt at all
function valueOf(content, math) {
  const text = String(content).trim().split(/\s+/)[0] || '';
  if (/^\d+$/.test(text)) return Number(text);
  if (!math || !/^[\d\s+\-*/^().%x×÷!]+$/i.test(text) || !/\d/.test(text)) return null;
  try {
    const n = evaluate(text.replace(/x/gi, '*'));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

// Returns true when the message was handled as a count (right or wrong)
async function check(message) {
  const cfg = db.guild(message.guild.id).counting;
  if (!cfg.channel || message.channel.id !== cfg.channel || !isOn(message.guild.id, 'counting')) return false;
  const n = valueOf(message.content, cfg.math);
  if (n === null) return false; // chatting in the channel is fine, it just doesn't count

  const expected = cfg.current + 1;
  if (message.author.id === cfg.lastUser) {
    await message.react('⚠️').catch(() => {});
    await message.reply({ content: "Let someone else have a go, you can't count twice in a row. The count is still going.", allowedMentions: { repliedUser: false } }).catch(() => {});
    await message.delete().catch(() => {});
    return true;
  }
  if (n !== expected) {
    const reached = cfg.current;
    cfg.current = 0;
    cfg.lastUser = null;
    db.save();
    await message.react('❌').catch(() => {});
    await message
      .reply({ content: `💥 ${message.author} ruined it at **${reached}**! The next number was **${expected}**. Back to **1**.`, allowedMentions: { repliedUser: false } })
      .catch(() => {});
    return true;
  }
  cfg.current = expected;
  cfg.lastUser = message.author.id;
  const record = expected > cfg.best;
  if (record) cfg.best = expected;
  db.save();
  await message.react(record && expected % 50 === 0 ? '🏆' : expected % 100 === 0 ? '💯' : '✅').catch(() => {});
  return true;
}

module.exports = { check, valueOf };
