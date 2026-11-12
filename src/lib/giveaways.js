const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./db');
const { card, C } = require('./ui');
const { ts, shuffle } = require('./util');

function render(g) {
  const ended = g.ended;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`gstart:join:${g.id}`)
      .setLabel(ended ? 'All done' : `I'm in (${g.entries.length})`)
      .setEmoji('🎉')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(ended),
  );
  const winners = ended
    ? g.winners.length
      ? g.winners.map((w) => `<@${w}>`).join(', ')
      : 'Nobody. Tumbleweeds.'
    : null;
  return card({
    title: `🎉 ${g.prize}`,
    color: ended ? C.info : C.fun,
    description: ended
      ? `The dust has settled ${ts(g.endsAt, 'R')}`
      : `Hit **I'm in** for a shot at this one!\nWraps up ${ts(g.endsAt, 'R')} (${ts(g.endsAt, 'f')})`,
    fields: [
      ['Hosted by', `<@${g.hostId}>`],
      ['Winners', ended ? winners : String(g.winnerCount)],
      ['Entries', String(g.entries.length)],
    ],
    footer: `ID: ${g.id}`,
    rows: [row],
  });
}

function draw(g) {
  return shuffle(g.entries).slice(0, g.winnerCount);
}

async function end(client, g) {
  g.ended = true;
  g.winners = draw(g);
  db.save();
  const ch = await client.channels.fetch(g.channelId).catch(() => null);
  if (!ch) return g;
  const msg = await ch.messages.fetch(g.messageId).catch(() => null);
  // Don't ping winners from the edited card; the announcement below does that
  if (msg) await msg.edit({ ...render(g), allowedMentions: { parse: [] } }).catch(() => {});
  await ch
    .send({
      ...card({
        description: g.winners.length
          ? `🎊 Nice one ${g.winners.map((w) => `<@${w}>`).join(', ')}! **${g.prize}** is yours.`
          : `Not a single entry for **${g.prize}**. Awkward. Maybe next time?`,
        color: C.success,
      }),
      allowedMentions: { users: g.winners },
    })
    .catch(() => {});
  return g;
}

module.exports = { render, end, draw };
