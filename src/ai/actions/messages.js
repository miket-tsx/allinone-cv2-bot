const { PermissionFlagsBits: P } = require('discord.js');
const r = require('../resolve');
const { card } = require('../../lib/ui');

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
const quiet = { parse: [] };

module.exports = [
  {
    name: 'read_recent_messages',
    description: 'Read the latest messages in a channel to get context',
    params: { channel: 's Channel (defaults to the current one)', count: 'n How many, up to 30' },
    async run(env, a) {
      const ch = r.channel(env, a.channel, { optional: true });
      const msgs = await ch.messages.fetch({ limit: Math.min(30, a.count || 15) });
      return msgs
        .reverse()
        .map((m) => `[${m.id}] ${m.author.username}: ${m.content.slice(0, 200) || '(no text)'}`)
        .join('\n');
    },
  },
  {
    name: 'send_message',
    description: 'Post a plain message in a channel',
    params: { channel: 's! Channel', text: 's! What to say' },
    perms: [P.ManageMessages],
    confirm: true,
    async run(env, a) {
      const ch = r.channel(env, a.channel);
      await ch.send({ content: a.text.slice(0, 2000), allowedMentions: quiet });
      return `Posted in #${ch.name}.`;
    },
  },
  {
    name: 'post_announcement',
    description: 'Post a nicely formatted announcement card, optionally pinging a role',
    params: {
      channel: 's! Channel',
      title: 's! Headline',
      text: 's! Body',
      ping: 's Role to ping, or "everyone"',
    },
    perms: [P.ManageMessages, P.MentionEveryone],
    confirm: true,
    async run(env, a) {
      const ch = r.channel(env, a.channel);
      const payload = card({
        title: a.title,
        description: a.text,
        footer: `Posted by ${env.member.displayName}`,
      });
      if (a.ping) {
        const role = r.role(env, a.ping);
        await ch.send({
          content: role.id === env.guild.id ? '@everyone' : `<@&${role.id}>`,
          allowedMentions: { parse: ['everyone'], roles: [role.id] },
        });
      }
      await ch.send({ ...payload, allowedMentions: quiet });
      return `Announcement posted in #${ch.name}.`;
    },
  },
  {
    name: 'edit_bot_message',
    description: 'Edit a plain text message that I sent earlier',
    params: { message_id: 's! Message ID', text: 's! New text', channel: 's Channel it is in' },
    perms: [P.ManageMessages],
    confirm: true,
    async run(env, a) {
      const msg = await r.message(env, a.message_id, a.channel);
      if (msg.author.id !== env.client.user.id) return 'I can only edit my own messages.';
      await msg.edit({ content: a.text.slice(0, 2000) });
      return 'Edited.';
    },
  },
  {
    name: 'delete_message',
    description: 'Delete a single message',
    params: { message_id: 's! Message ID', channel: 's Channel it is in' },
    perms: [P.ManageMessages],
    confirm: true,
    async run(env, a) {
      const msg = await r.message(env, a.message_id, a.channel);
      await msg.delete();
      return `Deleted a message from ${msg.author.username}.`;
    },
  },
  {
    name: 'purge_messages',
    description: 'Bulk delete recent messages, optionally only from one user or containing some text',
    params: {
      count: 'n! How many to check, up to 100',
      channel: 's Channel (defaults to the current one)',
      from: 's Only messages from this member',
      contains: 's Only messages containing this text',
    },
    perms: [P.ManageMessages],
    confirm: true,
    danger: true,
    async run(env, a) {
      const ch = r.channel(env, a.channel, { optional: true });
      const from = a.from ? await r.member(env, a.from) : null;
      let msgs = await ch.messages.fetch({ limit: Math.min(100, Math.max(1, a.count)) });
      msgs = msgs.filter(
        (m) =>
          Date.now() - m.createdTimestamp < FOURTEEN_DAYS &&
          (!from || m.author.id === from.id) &&
          (!a.contains || m.content.toLowerCase().includes(a.contains.toLowerCase())),
      );
      const gone = await ch.bulkDelete(msgs, true);
      return `Deleted ${gone.size} messages in #${ch.name}.`;
    },
  },
  {
    name: 'pin_message',
    description: 'Pin a message',
    params: { message_id: 's! Message ID', channel: 's Channel it is in' },
    perms: [P.ManageMessages],
    confirm: true,
    async run(env, a) {
      const msg = await r.message(env, a.message_id, a.channel);
      await msg.pin(env.reason);
      return 'Pinned.';
    },
  },
  {
    name: 'unpin_message',
    description: 'Unpin a message',
    params: { message_id: 's! Message ID', channel: 's Channel it is in' },
    perms: [P.ManageMessages],
    confirm: true,
    async run(env, a) {
      const msg = await r.message(env, a.message_id, a.channel);
      await msg.unpin(env.reason);
      return 'Unpinned.';
    },
  },
  {
    name: 'list_pins',
    description: 'List pinned messages in a channel',
    params: { channel: 's Channel (defaults to the current one)' },
    async run(env, a) {
      const ch = r.channel(env, a.channel, { optional: true });
      const pins = await ch.messages.fetchPinned();
      return pins.size
        ? pins.map((m) => `[${m.id}] ${m.author.username}: ${m.content.slice(0, 120)}`).join('\n')
        : 'Nothing pinned.';
    },
  },
  {
    name: 'react_to_message',
    description: 'Add an emoji reaction to a message',
    params: { message_id: 's! Message ID', emoji: 's! Emoji', channel: 's Channel it is in' },
    async run(env, a) {
      const msg = await r.message(env, a.message_id, a.channel);
      await msg.react(a.emoji);
      return 'Reacted.';
    },
  },
  {
    name: 'publish_announcement',
    description: 'Publish a message in an announcement channel to following servers',
    params: { message_id: 's! Message ID', channel: 's! Announcement channel' },
    perms: [P.ManageMessages],
    confirm: true,
    async run(env, a) {
      const msg = await r.message(env, a.message_id, a.channel);
      if (!msg.crosspostable) return "That message can't be published.";
      await msg.crosspost();
      return 'Published.';
    },
  },
  {
    name: 'dm_member',
    description: 'Send a member a direct message from the server staff',
    params: { member: 's! Member', text: 's! Message' },
    perms: [P.ManageGuild],
    confirm: true,
    async run(env, a) {
      const m = await r.member(env, a.member);
      const sent = await m
        .send(card({ title: `Message from ${env.guild.name} staff`, description: a.text.slice(0, 1800) }))
        .catch(() => null);
      return sent ? `Sent a DM to ${m.user.username}.` : `${m.user.username} has DMs closed.`;
    },
  },
];
