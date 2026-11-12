const { PermissionFlagsBits: P, ChannelType } = require('discord.js');
const db = require('../lib/db');
const { card, ok, C } = require('../lib/ui');
const { assert, parseDur, fmtDur, ts } = require('../lib/util');
const { sendLog } = require('../lib/log');

const reasonOpt = {
  name: 'reason',
  type: 'string',
  description: 'Why? (optional, but future you will thank you)',
};
const userOpt = (d = 'Target member') => ({ name: 'user', type: 'user', required: true, description: d });

async function target(ctx, user, { needMember = true } = {}) {
  assert(user.id !== ctx.user.id, "Nice try, but you can't do that to yourself.");
  assert(user.id !== ctx.client.user.id, "I'm not doing that to myself, thanks.");
  const m = await ctx.getMember(user);
  if (!m) {
    // ban-by-ID is allowed for people who already left, so callers can opt out
    assert(!needMember, "I can't find that person in this server.");
    return null;
  }
  assert(m.id !== ctx.guild.ownerId, 'The server owner is off-limits.');
  if (ctx.user.id !== ctx.guild.ownerId)
    assert(
      ctx.member.roles.highest.position > m.roles.highest.position,
      "That member's top role is equal to or higher than yours, so hands off.",
    );
  return m;
}
const modLog = (ctx, action, user, reason, extra = []) =>
  sendLog(ctx.guild, {
    title: `🔨 ${action}`,
    color: C.mod,
    fields: [
      ['User', `${user} (${user.id})`],
      ['Moderator', `${ctx.user}`],
      ['Reason', reason || 'No reason given'],
      ...extra,
    ],
  });
// DMs are best-effort; plenty of people have them closed
const dm = (user, guild, action, reason) =>
  user
    .send(
      card({
        title: `You were ${action} in ${guild.name}`,
        description: `Reason: ${reason || 'No reason given'}`,
        color: C.mod,
      }),
    )
    .catch(() => {});

async function fetchMsgs(ctx, amount, filter) {
  const msgs = await ctx.channel.messages.fetch({ limit: 100 });
  // bulkDelete refuses anything older than 14 days
  const cut = Date.now() - 14 * 86400000;
  let list = [...msgs.values()].filter(
    (m) => m.createdTimestamp > cut && m.id !== ctx.message?.id && !m.pinned,
  );
  if (filter) list = list.filter(filter);
  return list.slice(0, amount);
}
function purgeCmd(name, description, filter, extraOpts = []) {
  return {
    name,
    description,
    guildOnly: true,
    perms: [P.ManageMessages],
    botPerms: [P.ManageMessages],
    cooldown: 5,
    options: [
      {
        name: 'amount',
        type: 'integer',
        required: true,
        min: 1,
        max: 100,
        description: 'How many messages to scan (1-100)',
      },
      ...extraOpts,
    ],
    async run(ctx, a) {
      if (ctx.message) await ctx.message.delete().catch(() => {});
      const list = await fetchMsgs(ctx, a.amount, filter && ((m) => filter(m, a)));
      const del = list.length ? await ctx.channel.bulkDelete(list, true) : new Map();
      const out = { ...ok(`Swept away **${del.size}** message(s). 🧹`), ephemeral: true };
      if (ctx.isSlash) return out;
      // prefix replies can't be ephemeral, so clean up after ourselves
      const m = await ctx.channel.send(out);
      setTimeout(() => m.delete().catch(() => {}), 4000);
    },
  };
}
const lockCmd = (name, description, deny, hide = false) => ({
  name,
  description,
  guildOnly: true,
  perms: [P.ManageChannels],
  botPerms: [P.ManageChannels],
  options: [{ name: 'channel', type: 'channel', description: 'Which channel? (defaults to this one)' }],
  async run(ctx, a) {
    const ch = a.channel || ctx.channel;
    const perm = hide
      ? { ViewChannel: deny ? false : null }
      : { SendMessages: deny ? false : null, SendMessagesInThreads: deny ? false : null };
    await ch.permissionOverwrites.edit(ctx.guild.roles.everyone, perm);
    return ok(`${ch} is now ${hide ? (deny ? 'hidden' : 'unhidden') : deny ? 'locked 🔒' : 'unlocked 🔓'}.`);
  },
});
const voiceCmd = (name, description, fn) => ({
  name,
  description,
  guildOnly: true,
  perms: [P.MuteMembers],
  botPerms: [P.MuteMembers, P.MoveMembers],
  options: [userOpt()],
  async run(ctx, a) {
    const m = await target(ctx, a.user);
    assert(m.voice.channel, "They're not in a voice channel, so there's nothing to do.");
    await fn(m);
    return ok(`**${name}** applied to ${m}. Smooth.`);
  },
});

module.exports = [
  {
    name: 'ban',
    description: 'Ban a member (or a user ID) from the server',
    guildOnly: true,
    perms: [P.BanMembers],
    botPerms: [P.BanMembers],
    aliases: ['hackban'],
    options: [
      userOpt('User to ban'),
      { name: 'days', type: 'integer', min: 0, max: 7, description: 'Days of message history to wipe (0-7)' },
      reasonOpt,
    ],
    async run(ctx, a) {
      const m = await target(ctx, a.user, { needMember: false });
      if (m) assert(m.bannable, "I can't ban that member. Their role outranks (or matches) mine.");
      // DM before the ban, while we still share a server with them
      if (m) await dm(a.user, ctx.guild, 'banned', a.reason);
      await ctx.guild.members.ban(a.user.id, {
        reason: `${ctx.user.tag}: ${a.reason || 'No reason'}`,
        deleteMessageSeconds: (a.days || 0) * 86400,
      });
      modLog(ctx, 'Ban', a.user, a.reason);
      return card({
        title: 'Member banned',
        description: `🔨 **${a.user.tag}** has been shown the door.`,
        fields: [['Reason', a.reason || 'No reason given']],
        color: C.mod,
      });
    },
  },
  {
    name: 'unban',
    description: 'Give someone a second chance: unban a user by ID',
    guildOnly: true,
    perms: [P.BanMembers],
    botPerms: [P.BanMembers],
    options: [
      { name: 'userid', type: 'string', required: true, description: 'ID of the user to unban', rest: false },
      reasonOpt,
    ],
    async run(ctx, a) {
      const id = a.userid.replace(/\D/g, '');
      const ban = await ctx.guild.bans.fetch(id).catch(() => null);
      assert(ban, "That user isn't banned, so there's nothing to undo.");
      await ctx.guild.members.unban(id, a.reason);
      modLog(ctx, 'Unban', ban.user, a.reason);
      return ok(`**${ban.user.tag}** is free to come back.`);
    },
  },
  {
    name: 'softban',
    description: 'Ban then instantly unban to wipe a member’s recent messages',
    guildOnly: true,
    perms: [P.BanMembers],
    botPerms: [P.BanMembers],
    options: [userOpt(), reasonOpt],
    async run(ctx, a) {
      const m = await target(ctx, a.user);
      assert(m.bannable, "I can't ban that member.");
      await ctx.guild.members.ban(m.id, {
        reason: `Softban: ${a.reason || ''}`,
        deleteMessageSeconds: 7 * 86400,
      });
      await ctx.guild.members.unban(m.id, 'Softban release');
      modLog(ctx, 'Softban', a.user, a.reason);
      return ok(`Softbanned **${a.user.tag}**. Their last 7 days of messages are gone.`);
    },
  },
  {
    name: 'kick',
    description: 'Kick a member from the server',
    guildOnly: true,
    perms: [P.KickMembers],
    botPerms: [P.KickMembers],
    options: [userOpt(), reasonOpt],
    async run(ctx, a) {
      const m = await target(ctx, a.user);
      assert(m.kickable, "I can't kick that member.");
      await dm(a.user, ctx.guild, 'kicked', a.reason);
      await m.kick(a.reason);
      modLog(ctx, 'Kick', a.user, a.reason);
      return card({
        title: 'Member kicked',
        description: `👢 **${a.user.tag}** got the boot.`,
        fields: [['Reason', a.reason || 'No reason given']],
        color: C.mod,
      });
    },
  },
  {
    name: 'timeout',
    description: 'Put a member in timeout (e.g. 10m, 2h, 1d — max 28d)',
    guildOnly: true,
    perms: [P.ModerateMembers],
    botPerms: [P.ModerateMembers],
    aliases: ['mute'],
    options: [
      userOpt(),
      {
        name: 'duration',
        type: 'string',
        required: true,
        description: 'How long, like 10m, 1h30m, 2d',
        rest: false,
      },
      reasonOpt,
    ],
    async run(ctx, a) {
      const ms = parseDur(a.duration);
      // 28d is Discord's hard limit for timeouts
      assert(ms && ms <= 28 * 86400000, 'Give me a duration between 1s and 28d, like `10m` or `2h`.');
      const m = await target(ctx, a.user);
      assert(m.moderatable, "I can't time that member out. Probably a role-hierarchy thing.");
      await m.timeout(ms, a.reason);
      modLog(ctx, 'Timeout', a.user, a.reason, [['Duration', fmtDur(ms)]]);
      return card({
        title: 'Member timed out',
        description: `🔇 ${m} is in the corner until ${ts(Date.now() + ms, 'f')}.`,
        fields: [['Reason', a.reason || 'No reason given']],
        color: C.mod,
      });
    },
  },
  {
    name: 'untimeout',
    description: 'Let a member out of timeout early',
    guildOnly: true,
    perms: [P.ModerateMembers],
    botPerms: [P.ModerateMembers],
    aliases: ['unmute'],
    options: [userOpt(), reasonOpt],
    async run(ctx, a) {
      const m = await target(ctx, a.user);
      await m.timeout(null, a.reason);
      modLog(ctx, 'Untimeout', a.user, a.reason);
      return ok(`${m} is out of timeout. Time served.`);
    },
  },
  {
    name: 'warn',
    description: 'Warn a member (it goes on their record)',
    guildOnly: true,
    perms: [P.ModerateMembers],
    options: [
      userOpt(),
      { name: 'reason', type: 'string', required: true, description: 'What are you warning them about?' },
    ],
    async run(ctx, a) {
      await target(ctx, a.user);
      const g = db.guild(ctx.guild.id);
      g.warns[a.user.id] ??= [];
      g.warns[a.user.id].push({ reason: a.reason, mod: ctx.user.id, at: Date.now() });
      db.save();
      await dm(a.user, ctx.guild, 'warned', a.reason);
      modLog(ctx, 'Warn', a.user, a.reason);
      return card({
        title: 'Member warned',
        description: `⚠️ ${a.user} is up to **${g.warns[a.user.id].length}** warning(s).`,
        fields: [['Reason', a.reason]],
        color: C.warn,
      });
    },
  },
  {
    name: 'warnings',
    description: 'See a member’s warnings',
    guildOnly: true,
    perms: [P.ModerateMembers],
    aliases: ['warns'],
    options: [userOpt('Member to look up')],
    async run(ctx, a) {
      const list = db.guild(ctx.guild.id).warns[a.user.id] || [];
      return card({
        title: `Warnings — ${a.user.tag}`,
        color: C.warn,
        description: list.length
          ? list.map((w, i) => `**#${i + 1}** ${w.reason} — <@${w.mod}> ${ts(w.at, 'R')}`).join('\n')
          : 'Squeaky clean. No warnings here ✨',
      });
    },
  },
  {
    name: 'delwarn',
    description: 'Delete a single warning by its number',
    guildOnly: true,
    perms: [P.ModerateMembers],
    options: [
      userOpt(),
      {
        name: 'number',
        type: 'integer',
        required: true,
        min: 1,
        description: 'Which warning? (the number from the warnings list)',
      },
    ],
    async run(ctx, a) {
      const list = db.guild(ctx.guild.id).warns[a.user.id] || [];
      assert(list[a.number - 1], "There's no warning with that number.");
      list.splice(a.number - 1, 1);
      db.save();
      return ok(`Warning #${a.number} is gone from ${a.user}'s record.`);
    },
  },
  {
    name: 'clearwarns',
    description: 'Wipe every warning for a member',
    guildOnly: true,
    perms: [P.ModerateMembers],
    options: [userOpt()],
    async run(ctx, a) {
      delete db.guild(ctx.guild.id).warns[a.user.id];
      db.save();
      return ok(`${a.user} has a clean slate again.`);
    },
  },
  purgeCmd('purge', 'Bulk delete recent messages', null),
  purgeCmd(
    'purgeuser',
    'Delete recent messages from one specific user',
    (m, a) => m.author.id === a.user.id,
    [{ name: 'user', type: 'user', required: true, description: 'Whose messages should go?' }],
  ),
  purgeCmd('purgebots', 'Delete recent messages sent by bots', (m) => m.author.bot),
  purgeCmd('purgehumans', 'Delete recent messages sent by actual humans', (m) => !m.author.bot),
  purgeCmd('purgelinks', 'Delete recent messages containing links', (m) => /https?:\/\//i.test(m.content)),
  purgeCmd('purgeattachments', 'Delete recent messages with attachments', (m) => m.attachments.size > 0),
  purgeCmd('purgeembeds', 'Delete recent messages with embeds', (m) => m.embeds.length > 0),
  purgeCmd(
    'purgementions',
    'Delete recent messages that ping users or roles',
    (m) => m.mentions.users.size + m.mentions.roles.size > 0,
  ),
  purgeCmd(
    'purgecontains',
    'Delete recent messages containing some text',
    (m, a) => m.content.toLowerCase().includes(a.text.toLowerCase()),
    [{ name: 'text', type: 'string', required: true, description: 'Text to look for (case-insensitive)' }],
  ),
  {
    name: 'slowmode',
    description: 'Set channel slowmode (0 to turn it off), e.g. 5s, 1m',
    guildOnly: true,
    perms: [P.ManageChannels],
    botPerms: [P.ManageChannels],
    options: [
      { name: 'duration', type: 'string', required: true, description: 'Like 5s, 30s, 2m, or 0 for off' },
    ],
    async run(ctx, a) {
      const ms = a.duration === '0' || a.duration === 'off' ? 0 : parseDur(a.duration);
      assert(
        ms !== null && ms <= 6 * 3600000,
        'Keep it to 6h or less, like `10s` — or use `0` to turn slowmode off.',
      );
      await ctx.channel.setRateLimitPerUser(Math.floor(ms / 1000));
      return ok(
        ms ? `Slowmode set to **${fmtDur(ms)}**. Take a breath, everyone.` : 'Slowmode is off. Chat away!',
      );
    },
  },
  lockCmd('lock', 'Stop @everyone from sending messages in a channel', true),
  lockCmd('unlock', 'Let @everyone send messages in a channel again', false),
  lockCmd('hide', 'Hide a channel from @everyone', true, true),
  lockCmd('unhide', 'Make a hidden channel visible to @everyone again', false, true),
  {
    name: 'lockdown',
    description: 'Lock every text channel in the server',
    guildOnly: true,
    perms: [P.Administrator],
    botPerms: [P.ManageChannels],
    cooldown: 30,
    defer: true,
    async run(ctx) {
      const chans = ctx.guild.channels.cache.filter((c) => c.type === ChannelType.GuildText);
      let n = 0;
      for (const c of chans.values()) {
        // skip channels we can't edit instead of aborting halfway
        if (
          await c.permissionOverwrites
            .edit(ctx.guild.roles.everyone, { SendMessages: false })
            .catch(() => null)
        )
          n++;
      }
      return card({
        title: '🔒 Server lockdown',
        description: `Locked **${n}** text channels. Run \`unlockdown\` when the dust settles.`,
        color: C.error,
      });
    },
  },
  {
    name: 'unlockdown',
    description: 'Unlock every text channel in the server',
    guildOnly: true,
    perms: [P.Administrator],
    botPerms: [P.ManageChannels],
    cooldown: 30,
    defer: true,
    async run(ctx) {
      const chans = ctx.guild.channels.cache.filter((c) => c.type === ChannelType.GuildText);
      let n = 0;
      for (const c of chans.values()) {
        if (
          await c.permissionOverwrites
            .edit(ctx.guild.roles.everyone, { SendMessages: null })
            .catch(() => null)
        )
          n++;
      }
      return ok(`Unlocked **${n}** text channels. Back to normal.`);
    },
  },
  {
    name: 'nick',
    description: 'Change a member’s nickname',
    guildOnly: true,
    perms: [P.ManageNicknames],
    botPerms: [P.ManageNicknames],
    aliases: ['setnick'],
    options: [
      userOpt(),
      { name: 'nickname', type: 'string', required: true, description: 'New nickname (max 32 chars)' },
    ],
    async run(ctx, a) {
      assert(a.nickname.length <= 32, 'Discord caps nicknames at 32 characters, so trim it down a bit.');
      const m = await ctx.getMember(a.user);
      assert(m?.manageable, "I can't change that member's nickname.");
      await m.setNickname(a.nickname);
      return ok(`${m} is now going by **${a.nickname}**.`);
    },
  },
  {
    name: 'resetnick',
    description: 'Reset a member’s nickname',
    guildOnly: true,
    perms: [P.ManageNicknames],
    botPerms: [P.ManageNicknames],
    options: [userOpt()],
    async run(ctx, a) {
      const m = await ctx.getMember(a.user);
      assert(m?.manageable, "I can't change that member's nickname.");
      await m.setNickname(null);
      return ok(`${m}'s nickname is back to normal.`);
    },
  },
  {
    name: 'dehoist',
    description: 'Strip leading symbols people use to hoist their names to the top',
    guildOnly: true,
    perms: [P.ManageNicknames],
    botPerms: [P.ManageNicknames],
    cooldown: 30,
    defer: true,
    async run(ctx) {
      const all = await ctx.guild.members.fetch();
      let n = 0;
      for (const m of all.values()) {
        if (!m.manageable || !/^[^a-zA-Z0-9]/.test(m.displayName)) continue;
        // fallback so a name made only of symbols doesn't end up empty
        const clean = m.displayName.replace(/^[^a-zA-Z0-9]+/, '').slice(0, 32) || 'dehoisted';
        if (await m.setNickname(clean).catch(() => null)) n++;
      }
      return ok(`Brought **${n}** member(s) back down to earth.`);
    },
  },
  {
    name: 'addrole',
    description: 'Give a role to a member',
    guildOnly: true,
    perms: [P.ManageRoles],
    botPerms: [P.ManageRoles],
    aliases: ['giverole'],
    options: [userOpt(), { name: 'role', type: 'role', required: true, description: 'Role to add' }],
    async run(ctx, a) {
      const m = await ctx.getMember(a.user);
      assert(m, "I can't find that member.");
      assert(a.role.editable, "That role sits above my highest role, so I can't touch it.");
      if (ctx.user.id !== ctx.guild.ownerId)
        assert(
          a.role.position < ctx.member.roles.highest.position,
          'That role is above your highest one. Nice try though.',
        );
      await m.roles.add(a.role);
      return ok(`${m} now has ${a.role}.`);
    },
  },
  {
    name: 'removerole',
    description: 'Take a role away from a member',
    guildOnly: true,
    perms: [P.ManageRoles],
    botPerms: [P.ManageRoles],
    aliases: ['takerole'],
    options: [userOpt(), { name: 'role', type: 'role', required: true, description: 'Role to remove' }],
    async run(ctx, a) {
      const m = await ctx.getMember(a.user);
      assert(m, "I can't find that member.");
      assert(a.role.editable, "That role sits above my highest role, so I can't touch it.");
      if (ctx.user.id !== ctx.guild.ownerId)
        assert(
          a.role.position < ctx.member.roles.highest.position,
          'That role is above your highest one. Nice try though.',
        );
      await m.roles.remove(a.role);
      return ok(`${a.role} has been taken from ${m}.`);
    },
  },
  {
    name: 'nuke',
    description: 'Clone this channel and delete the original (wipes all messages)',
    guildOnly: true,
    perms: [P.Administrator],
    botPerms: [P.ManageChannels],
    cooldown: 60,
    async run(ctx) {
      const old = ctx.channel;
      const clone = await old.clone({ reason: `Nuked by ${ctx.user.tag}` });
      await clone.setPosition(old.position);
      await old.delete();
      // the original is gone, so there's nothing to reply to; post in the clone
      await clone.send(
        card({
          title: '💥 Channel nuked',
          description: `Nuked by ${ctx.user}. Fresh start, clean slate.`,
          color: C.error,
        }),
      );
    },
  },
  {
    name: 'renamechannel',
    description: 'Rename the current channel',
    guildOnly: true,
    perms: [P.ManageChannels],
    botPerms: [P.ManageChannels],
    options: [{ name: 'name', type: 'string', required: true, description: 'New channel name' }],
    async run(ctx, a) {
      await ctx.channel.setName(a.name.slice(0, 100));
      return ok(`This channel is now called **${a.name}**.`);
    },
  },
  {
    name: 'settopic',
    description: 'Set the current channel’s topic',
    guildOnly: true,
    perms: [P.ManageChannels],
    botPerms: [P.ManageChannels],
    options: [{ name: 'topic', type: 'string', required: true, description: 'New topic' }],
    async run(ctx, a) {
      await ctx.channel.setTopic(a.topic.slice(0, 1024));
      return ok('Topic updated.');
    },
  },
  voiceCmd('vckick', 'Disconnect a member from voice', (m) => m.voice.disconnect()),
  voiceCmd('vcmute', 'Server-mute a member in voice', (m) => m.voice.setMute(true)),
  voiceCmd('vcunmute', 'Server-unmute a member in voice', (m) => m.voice.setMute(false)),
  voiceCmd('deafen', 'Server-deafen a member in voice', (m) => m.voice.setDeaf(true)),
  voiceCmd('undeafen', 'Server-undeafen a member in voice', (m) => m.voice.setDeaf(false)),
  {
    name: 'vcmove',
    description: 'Move a member to another voice channel',
    guildOnly: true,
    perms: [P.MoveMembers],
    botPerms: [P.MoveMembers],
    options: [
      userOpt(),
      {
        name: 'channel',
        type: 'channel',
        required: true,
        description: 'Where to send them (a voice channel)',
      },
    ],
    async run(ctx, a) {
      const m = await ctx.getMember(a.user);
      assert(m?.voice.channel, "They're not in voice, so there's nobody to move.");
      assert(a.channel.isVoiceBased(), "That's not a voice channel. Pick one with a mic icon.");
      await m.voice.setChannel(a.channel);
      return ok(`Moved ${m} to ${a.channel}.`);
    },
  },
  {
    name: 'banlist',
    description: 'Show who’s banned from the server',
    guildOnly: true,
    perms: [P.BanMembers],
    botPerms: [P.BanMembers],
    async run(ctx) {
      const bans = await ctx.guild.bans.fetch();
      return card({
        title: `Bans (${bans.size})`,
        color: C.mod,
        description: bans.size
          ? bans
              .first(30)
              .map((b) => `• **${b.user.tag}** \`${b.user.id}\` — ${b.reason || 'no reason'}`)
              .join('\n')
          : 'Nobody is banned. Peaceful.',
      });
    },
  },
  {
    name: 'baninfo',
    description: 'Look up why a user was banned',
    guildOnly: true,
    perms: [P.BanMembers],
    botPerms: [P.BanMembers],
    options: [{ name: 'userid', type: 'string', required: true, description: 'ID of the banned user' }],
    async run(ctx, a) {
      const b = await ctx.guild.bans.fetch(a.userid.replace(/\D/g, '')).catch(() => null);
      assert(b, "That user isn't banned.");
      return card({
        title: `Ban — ${b.user.tag}`,
        thumbnail: b.user.displayAvatarURL(),
        fields: [
          ['ID', b.user.id],
          ['Reason', b.reason || 'None'],
        ],
        color: C.mod,
      });
    },
  },
  {
    name: 'modnote',
    description: 'Jot down a private moderator note about a member',
    guildOnly: true,
    perms: [P.ModerateMembers],
    options: [
      userOpt(),
      { name: 'note', type: 'string', required: true, description: 'What do you want to remember?' },
    ],
    async run(ctx, a) {
      const g = db.guild(ctx.guild.id);
      g.notes[a.user.id] ??= [];
      g.notes[a.user.id].push({ text: a.note, mod: ctx.user.id, at: Date.now() });
      db.save();
      return { ...ok(`Noted. Your secret about ${a.user} is safe with me.`), ephemeral: true };
    },
  },
  {
    name: 'modnotes',
    description: 'Read the moderator notes on a member',
    guildOnly: true,
    perms: [P.ModerateMembers],
    options: [userOpt()],
    async run(ctx, a) {
      const n = db.guild(ctx.guild.id).notes[a.user.id] || [];
      return {
        ...card({
          title: `Notes — ${a.user.tag}`,
          description: n.length
            ? n.map((x, i) => `**${i + 1}.** ${x.text} — <@${x.mod}> ${ts(x.at, 'R')}`).join('\n')
            : 'Nothing on file for this one.',
          color: C.mod,
        }),
        ephemeral: true,
      };
    },
  },
  {
    name: 'clearmodnotes',
    description: 'Shred all moderator notes for a member',
    guildOnly: true,
    perms: [P.ModerateMembers],
    options: [userOpt()],
    async run(ctx, a) {
      delete db.guild(ctx.guild.id).notes[a.user.id];
      db.save();
      return ok(`Notes on ${a.user} have been shredded.`);
    },
  },
  {
    name: 'massrole',
    description: 'Give a role to every human member (slow on big servers)',
    guildOnly: true,
    perms: [P.Administrator],
    botPerms: [P.ManageRoles],
    cooldown: 120,
    defer: true,
    options: [{ name: 'role', type: 'role', required: true, description: 'Role to hand out' }],
    async run(ctx, a) {
      assert(a.role.editable, "That role sits above my highest role, so I can't touch it.");
      const all = await ctx.guild.members.fetch();
      let n = 0;
      for (const m of all.values()) {
        if (m.user.bot || m.roles.cache.has(a.role.id)) continue;
        if (await m.roles.add(a.role).catch(() => null)) n++;
      }
      return ok(`${a.role} handed out to **${n}** member(s).`);
    },
  },
  {
    name: 'roleclear',
    description: 'Remove a role from everyone who has it',
    guildOnly: true,
    perms: [P.Administrator],
    botPerms: [P.ManageRoles],
    cooldown: 120,
    defer: true,
    options: [{ name: 'role', type: 'role', required: true, description: 'Role to strip from everyone' }],
    async run(ctx, a) {
      assert(a.role.editable, "That role sits above my highest role, so I can't touch it.");
      // the role's member list only covers cached members
      await ctx.guild.members.fetch();
      let n = 0;
      for (const m of a.role.members.values()) if (await m.roles.remove(a.role).catch(() => null)) n++;
      return ok(`Pulled ${a.role} from **${n}** member(s).`);
    },
  },
  {
    name: 'createrole',
    description: 'Create a brand new role',
    guildOnly: true,
    perms: [P.ManageRoles],
    botPerms: [P.ManageRoles],
    options: [
      {
        name: 'color',
        type: 'string',
        required: true,
        description: 'Hex color like #ff0055 (or "none")',
        rest: false,
      },
      { name: 'name', type: 'string', required: true, description: 'Role name' },
    ],
    async run(ctx, a) {
      const color = a.color.toLowerCase() === 'none' ? undefined : parseInt(a.color.replace('#', ''), 16);
      assert(
        color === undefined || (!Number.isNaN(color) && color <= 0xffffff),
        "That doesn't look like a hex color. Try something like `#ff0055`.",
      );
      const r = await ctx.guild.roles.create({
        name: a.name.slice(0, 100),
        color,
        reason: `By ${ctx.user.tag}`,
      });
      return ok(`Say hello to ${r}!`);
    },
  },
  {
    name: 'deleterole',
    description: 'Delete a role for good',
    guildOnly: true,
    perms: [P.ManageRoles],
    botPerms: [P.ManageRoles],
    options: [{ name: 'role', type: 'role', required: true, description: 'Role to delete' }],
    async run(ctx, a) {
      assert(a.role.editable, "That role sits above my highest role, so I can't touch it.");
      const n = a.role.name;
      await a.role.delete(`By ${ctx.user.tag}`);
      return ok(`Role **${n}** is gone.`);
    },
  },
];
