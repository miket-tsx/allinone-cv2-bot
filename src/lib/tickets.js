// Support tickets: a panel button opens a private channel for the member and staff,
// and closing it saves a transcript to the ticket log before the channel goes away.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  ChannelType,
  PermissionFlagsBits: P,
} = require('discord.js');
const db = require('./db');
const { card, C } = require('./ui');
const { UserError, ts } = require('./util');
const { sendLog } = require('./log');

const cfgOf = (guild) => db.guild(guild.id).tickets;

function panel(guild, title, description) {
  const cfg = cfgOf(guild);
  const row = new ActionRowBuilder();
  if (cfg.topics.length) {
    row.addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket:open')
        .setPlaceholder('What do you need help with?')
        .addOptions(cfg.topics.slice(0, 25).map((t, i) => ({ label: t.slice(0, 100), value: String(i) }))),
    );
  } else {
    row.addComponents(new ButtonBuilder().setCustomId('ticket:open').setLabel('Open a ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary));
  }
  return card({
    title: title || 'Need a hand?',
    description: description || "Open a ticket and the staff team will help you out in a private channel. Only you and staff can see it.",
    color: C.primary,
    rows: [row],
  });
}

const controls = (claimedBy) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:claim')
      .setLabel(claimedBy ? 'Claimed' : 'Claim')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!!claimedBy),
    new ButtonBuilder().setCustomId('ticket:close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
  );

function welcome(guild, t) {
  const staff = cfgOf(guild).staffRoles.filter((r) => guild.roles.cache.has(r));
  return card({
    title: `Ticket #${t.n}${t.topic ? `: ${t.topic}` : ''}`,
    description: `Hey <@${t.owner}>, thanks for reaching out. Tell us what's going on and someone from ${staff.map((r) => `<@&${r}>`).join(' ') || 'the staff team'} will be with you shortly.`,
    footer: t.claimedBy ? `Being handled by a staff member` : null,
    color: C.primary,
    rows: [controls(t.claimedBy)],
  });
}

async function open(guild, member, topic) {
  const cfg = cfgOf(guild);
  const mine = Object.entries(cfg.open).filter(([id, t]) => t.owner === member.id && guild.channels.cache.has(id));
  if (mine.length >= cfg.maxOpen) throw new UserError(`You already have a ticket open: <#${mine[0][0]}>`);
  const n = ++cfg.counter;
  const staff = cfg.staffRoles.filter((r) => guild.roles.cache.has(r));
  const channel = await guild.channels.create({
    name: `ticket-${String(n).padStart(4, '0')}`,
    type: ChannelType.GuildText,
    parent: guild.channels.cache.get(cfg.category)?.id,
    topic: `Ticket #${n} for ${member.user.username}${topic ? ` · ${topic}` : ''}`,
    permissionOverwrites: [
      { id: guild.id, deny: [P.ViewChannel] },
      { id: member.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles] },
      { id: guild.client.user.id, allow: [P.ViewChannel, P.SendMessages, P.ManageChannels, P.ReadMessageHistory] },
      ...staff.map((id) => ({ id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageMessages] })),
    ],
    reason: `Ticket opened by ${member.user.username}`,
  });
  cfg.open[channel.id] = { owner: member.id, n, topic: topic || null, opened: Date.now(), claimedBy: null };
  db.save();
  await channel.send({ ...welcome(guild, cfg.open[channel.id]), allowedMentions: { users: [member.id], roles: staff } });
  sendLog(guild, { title: 'Ticket opened', color: C.info, description: `#${n} by <@${member.id}> in <#${channel.id}>${topic ? ` · ${topic}` : ''}` }, 'moderation');
  return channel;
}

const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function transcript(channel, ticket) {
  let all = [];
  let before;
  // Up to 1000 messages; anything longer is a novel, not a ticket
  for (let i = 0; i < 10; i++) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) break;
    all.push(...batch.values());
    before = batch.last().id;
  }
  all = all.reverse();
  const rows = all
    .map((m) => {
      const text = m.content || m.components?.map((c) => JSON.stringify(c.toJSON?.() ?? c).match(/"content":"(.*?)"/)?.[1]).filter(Boolean).join(' ') || '';
      const files = [...m.attachments.values()].map((a) => `<a href="${escape(a.url)}">${escape(a.name)}</a>`).join(' ');
      return `<div class="m"><img src="${escape(m.author.displayAvatarURL({ size: 64 }))}"><div><b>${escape(m.author.username)}</b> <span>${m.createdAt.toLocaleString('en-GB')}</span><p>${escape(text).replace(/\\n|\n/g, '<br>')} ${files}</p></div></div>`;
    })
    .join('\n');
  const html = `<!doctype html><meta charset="utf-8"><title>Ticket #${ticket.n}</title>
<style>body{font-family:system-ui,sans-serif;background:#313338;color:#dbdee1;max-width:900px;margin:auto;padding:20px}
.m{display:flex;gap:12px;margin:14px 0}img{width:40px;height:40px;border-radius:50%}span{color:#949ba4;font-size:12px}p{margin:4px 0}a{color:#00a8fc}</style>
<h2>Ticket #${ticket.n} · ${escape(channel.guild.name)}</h2><p>${all.length} messages${ticket.topic ? ` · ${escape(ticket.topic)}` : ''}</p>${rows}`;
  return new AttachmentBuilder(Buffer.from(html), { name: `ticket-${ticket.n}.html` });
}

async function close(channel, closedBy, reason) {
  const guild = channel.guild;
  const cfg = cfgOf(guild);
  const ticket = cfg.open[channel.id];
  if (!ticket) throw new UserError("This channel isn't a ticket.");
  const file = await transcript(channel, ticket);
  const summary = card({
    title: `Ticket #${ticket.n} closed`,
    color: C.warn,
    fields: [
      ['Opened by', `<@${ticket.owner}>`],
      ['Closed by', `<@${closedBy.id}>`],
      ['Claimed by', ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Nobody'],
      ['Topic', ticket.topic],
      ['Opened', ts(ticket.opened, 'R')],
      ['Reason', reason || 'None given'],
    ],
  });
  const logCh = guild.channels.cache.get(cfg.logChannel);
  if (logCh?.isTextBased()) {
    await logCh.send({ ...summary, allowedMentions: { parse: [] } }).catch(() => {});
    await logCh.send({ files: [file] }).catch(() => {});
  }
  const owner = await guild.client.users.fetch(ticket.owner).catch(() => null);
  await owner?.send(summary).then(() => owner.send({ files: [file] })).catch(() => {});
  delete cfg.open[channel.id];
  db.save();
  await channel.send(card({ description: '🔒 Closing this ticket in 5 seconds. A transcript has been saved.', color: C.warn })).catch(() => {});
  setTimeout(() => channel.delete(`Ticket closed by ${closedBy.username}`).catch(() => {}), 5000);
}

const isStaff = (member) =>
  member.permissions.has(P.ManageChannels) || cfgOf(member.guild).staffRoles.some((r) => member.roles.cache.has(r));

module.exports = { panel, welcome, open, close, controls, isStaff, transcript, cfgOf };
