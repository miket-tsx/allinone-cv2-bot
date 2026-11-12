// Offline checks for the server features: automod, counting, custom commands, anti-raid,
// anti-nuke, starboard, reaction roles, scheduler, feeds, backups, AI moderation parsing and
// feature switches. Discord is faked with just enough shape for each check; nothing touches
// the network.
const os = require('os');
const path = require('path');
process.env.DB_PATH = path.join(os.tmpdir(), `featuretest-${process.pid}.sqlite`);
process.env.DB_FILE = path.join(os.tmpdir(), `featuretest-${process.pid}.json`);
delete process.env.GROQ_API_KEY;

const assert = require('assert');
const { Collection, PermissionsBitField, PermissionFlagsBits: P, AuditLogEvent: A, ChannelType } = require('discord.js');
const db = require('../src/lib/db');
const { loadCommands, slashCommands, resolveSlash, slashLabel } = require('../src/lib/registry');

global.fetch = async (url) => {
  throw new Error(`no network in tests (${url})`);
};

let ids = 1000;
const id = () => String(700000000000000000n + BigInt(ids++));

function fakeGuild() {
  const sent = [];
  const channels = new Collection();
  const guild = {
    id: id(),
    name: 'Feature Den',
    ownerId: '1',
    memberCount: 42,
    channels: { cache: channels },
    roles: { cache: new Collection() },
    members: { cache: new Collection(), fetch: async (uid) => guild.members.cache.get(uid) || null },
    client: { user: { id: '2' } },
  };
  const addChannel = (name) => {
    const ch = {
      id: id(),
      name,
      guild,
      parentId: null,
      type: ChannelType.GuildText,
      isTextBased: () => true,
      messages: { fetch: async (mid) => ch.posted.find((m) => m.id === mid) || null },
      posted: [],
      send: async (p) => {
        const m = { id: id(), payload: p, edit: async (q) => (m.payload = q), delete: async () => (ch.posted = ch.posted.filter((x) => x !== m)) };
        ch.posted.push(m);
        sent.push({ channel: name, payload: p });
        return m;
      },
    };
    channels.set(ch.id, ch);
    return ch;
  };
  return { guild, addChannel, sent };
}

function fakeMember(guild, perms = []) {
  const m = {
    id: id(),
    guild,
    displayName: 'Tester',
    user: { username: 'tester', bot: false, createdTimestamp: Date.now() - 400 * 86400_000 },
    permissions: new PermissionsBitField(perms),
    roles: {
      cache: new Collection(),
      added: [],
      removed: [],
      add: async (r) => m.roles.added.push(r),
      remove: async (r) => m.roles.removed.push(r),
    },
    punished: [],
    timeout: async (ms) => m.punished.push(`timeout ${ms}`),
    kick: async () => m.punished.push('kick'),
    ban: async () => m.punished.push('ban'),
    send: async () => {},
  };
  guild.members.cache.set(m.id, m);
  return m;
}

function fakeMessage(channel, member, content) {
  const msg = {
    id: id(),
    content,
    guild: channel.guild,
    channel,
    member,
    author: { id: member.id, username: member.user.username, bot: false },
    webhookId: null,
    mentions: { users: new Collection(), roles: new Collection(), everyone: false },
    attachments: new Collection(),
    reactions: [],
    deleted: false,
    replies: [],
    url: 'https://discord.com/channels/x/y/z',
    createdAt: new Date(),
    react: async (e) => msg.reactions.push(e),
    delete: async () => (msg.deleted = true),
    reply: async (p) => {
      msg.replies.push(p);
      return { delete: async () => {} };
    },
  };
  return msg;
}

const text = (p) => JSON.stringify(p);
const tick = () => new Promise((r) => setTimeout(r, 20));

(async () => {
  const { commands, aliases } = loadCommands();
  const client = { user: { id: '2', username: 'Slash' }, commands, aliases, channels: { fetch: async () => null } };

  // 1. Slash: exactly 100, groups within Discord's limits, and subcommands map back to commands
  {
    const slash = slashCommands(commands);
    assert.strictEqual(slash.length, 100);
    for (const s of slash) {
      assert(JSON.stringify(s).length < 8000, `/${s.name} payload is over Discord's 8000 char limit`);
      for (const sub of s.options.filter((o) => o.type === 1)) assert(sub.options.length <= 25);
    }
    const fake = { commandName: 'automod', options: { getSubcommand: () => 'badword' } };
    assert.strictEqual(resolveSlash(fake), 'badword');
    assert.strictEqual(slashLabel('ccadd'), '/cc add');
    const subs = slash.reduce((n, s) => n + s.options.filter((o) => o.type === 1).length, 0);
    console.log(`✔ slash: 100 top-level commands, ${subs} subcommands, all within Discord limits`);
  }

  const messageCreate = require('../src/events/messageCreate');

  // 2. Automod: invite gets deleted, strike recorded, 3rd strike times out, mods are exempt
  {
    const { guild, addChannel } = fakeGuild();
    const ch = addChannel('general');
    const g = db.guild(guild.id);
    g.automod.enabled = true;
    g.automod.filters.badwords.words = ['badword'];
    const user = fakeMember(guild);
    const inv = fakeMessage(ch, user, 'join discord.gg/freestuff');
    await messageCreate.run(client, inv);
    assert(inv.deleted, 'invite should be deleted');
    await messageCreate.run(client, fakeMessage(ch, user, 'you are a b4dw0rd'));
    await messageCreate.run(client, fakeMessage(ch, user, 'THIS IS ALL CAPS SHOUTING HERE'));
    assert.strictEqual(g.automod.strikes[user.id].length, 3);
    assert(user.punished[0]?.startsWith('timeout'), '3 strikes should time out');
    const mod = fakeMember(guild, [P.ManageMessages]);
    const modMsg = fakeMessage(ch, mod, 'discord.gg/partner');
    await messageCreate.run(client, modMsg);
    assert(!modMsg.deleted, 'mods are exempt');
    console.log('✔ automod: invite, leetspeak bad word and caps caught; 3rd strike timed out; mod exempt');
  }

  // 3. Counting: right numbers count, math works, double counting and wrong numbers are handled
  {
    const { guild, addChannel } = fakeGuild();
    const ch = addChannel('counting');
    const cfg = db.guild(guild.id).counting;
    cfg.channel = ch.id;
    const [a, b] = [fakeMember(guild), fakeMember(guild)];
    await messageCreate.run(client, fakeMessage(ch, a, '1'));
    await messageCreate.run(client, fakeMessage(ch, b, '1+1'));
    const twice = fakeMessage(ch, b, '3');
    await messageCreate.run(client, twice);
    assert(twice.deleted && cfg.current === 2, 'same person twice in a row should be removed');
    await messageCreate.run(client, fakeMessage(ch, a, '3'));
    await messageCreate.run(client, fakeMessage(ch, b, 'nice one'));
    assert.strictEqual(cfg.current, 3, 'chat should not break the count');
    const wrong = fakeMessage(ch, b, '7');
    await messageCreate.run(client, wrong);
    assert(cfg.current === 0 && cfg.best === 3 && text(wrong.replies).includes('ruined it at **3**'));
    console.log('✔ counting: 1, 1+1, 3 counted; double count removed; chat ignored; wrong number reset (best 3)');
  }

  // 4. Custom commands: fire with placeholders, built-ins win, feature switch turns them off
  {
    const { guild, addChannel, sent } = fakeGuild();
    const ch = addChannel('general');
    db.guild(guild.id).customCommands.rules = { response: 'Hi {user}, read the rules of {server}! {args}', by: '1', uses: 0, created: 0 };
    const user = fakeMember(guild);
    await messageCreate.run(client, fakeMessage(ch, user, '!rules please'));
    assert(text(sent.at(-1)).includes(`Hi <@${user.id}>, read the rules of Feature Den! please`));
    assert.strictEqual(db.guild(guild.id).customCommands.rules.uses, 1);
    require('../src/lib/features').set(guild.id, 'customcommands', false);
    const before = sent.length;
    await messageCreate.run(client, fakeMessage(ch, user, '!rules'));
    assert.strictEqual(sent.length, before, 'switched-off custom commands should stay quiet');
    console.log('✔ custom commands: placeholders filled, use counted, feature switch respected');
  }

  // 5. Category switch blocks commands; locked categories can't be switched off
  {
    const { guild, addChannel } = fakeGuild();
    const ch = addChannel('general');
    const admin = fakeMember(guild, [P.Administrator]);
    db.guild(guild.id).features['cat:economy'] = false;
    const m = fakeMessage(ch, admin, '!balance');
    await messageCreate.run(client, m);
    assert(text(m.replies).includes('economy commands are switched off'));
    const m2 = fakeMessage(ch, admin, '!feature moderation false');
    await messageCreate.run(client, m2);
    assert(text(m2.replies).includes("can't be switched off"));
    console.log('✔ feature switches: economy off blocks !balance; moderation is locked on');
  }

  // 6. Anti-raid: a burst of joins turns on raid mode and handles the rest
  {
    const security = require('../src/lib/security');
    const { guild, addChannel, sent } = fakeGuild();
    const log = addChannel('mod-log');
    const g = db.guild(guild.id);
    g.logChannel = log.id;
    Object.assign(g.antiraid, { enabled: true, joins: 5, seconds: 10, action: 'kick' });
    const joiners = Array.from({ length: 7 }, () => fakeMember(guild));
    for (const m of joiners) await security.onJoin(m);
    assert(g.antiraid.raidUntil > Date.now(), 'raid mode should be on');
    assert(joiners.slice(4).every((m) => m.punished.includes('kick')), 'joins from the 5th on should be kicked');
    assert(!joiners[0].punished.length, 'people who joined before the raid are left alone');
    assert(text(sent).includes('Raid detected'));
    const baby = fakeMember(guild);
    baby.user.createdTimestamp = Date.now() - 86400_000;
    Object.assign(g.antiraid, { raidUntil: 0, minAccountDays: 7 });
    await security.onJoin(baby);
    assert(baby.punished.includes('kick'), 'day-old account should be kicked');
    console.log('✔ anti-raid: 7 joins in a burst -> raid mode, joiners 5-7 kicked, 1-day-old account kicked');
  }

  // 7. Anti-nuke: mass channel deletes strip admin roles; whitelisted people are ignored
  {
    const security = require('../src/lib/security');
    const { guild } = fakeGuild();
    const g = db.guild(guild.id);
    g.antinuke.enabled = true;
    const rogue = fakeMember(guild);
    rogue.roles.cache.set('r1', { id: 'r1', managed: false, name: 'Admin', permissions: new PermissionsBitField([P.Administrator]) });
    rogue.roles.cache.set('r2', { id: 'r2', managed: false, name: 'Fan', permissions: new PermissionsBitField([]) });
    for (let i = 0; i < 3; i++) await security.onAudit({ action: A.ChannelDelete, executorId: rogue.id }, guild);
    const stripped = rogue.roles.removed[0];
    assert(stripped && stripped.has('r1') && !stripped.has('r2'), 'only the admin role should be stripped');
    const trusted = fakeMember(guild);
    g.antinuke.whitelist.push(trusted.id);
    for (let i = 0; i < 5; i++) await security.onAudit({ action: A.ChannelDelete, executorId: trusted.id }, guild);
    assert(!trusted.roles.removed.length);
    console.log('✔ anti-nuke: 3 channel deletes -> admin role stripped (other roles kept); trusted user ignored');
  }

  // 8. Starboard and reaction roles from reaction events
  {
    const [addEvent, removeEvent] = require('../src/events/community');
    const { guild, addChannel } = fakeGuild();
    const board = addChannel('starboard');
    const ch = addChannel('general');
    const g = db.guild(guild.id);
    Object.assign(g.starboard, { channel: board.id, threshold: 2 });
    const author = fakeMember(guild);
    const msg = fakeMessage(ch, author, 'this is a legendary message');
    msg.author.displayAvatarURL = () => 'https://cdn.example/a.png';
    ch.name = 'general';
    let starrers = new Collection();
    const reaction = { partial: false, emoji: { name: '⭐', id: null }, message: msg, users: { fetch: async () => starrers } };
    const fan = (i) => ({ id: `f${i}`, bot: false, partial: false });
    starrers.set('f1', fan(1));
    await addEvent.run(client, reaction, fan(1));
    assert.strictEqual(board.posted.length, 0, 'one star is under the threshold');
    starrers.set('f2', fan(2));
    await addEvent.run(client, reaction, fan(2));
    assert.strictEqual(board.posted.length, 1, 'two stars should post');
    starrers = new Collection([['f1', fan(1)]]);
    await removeEvent.run(client, reaction, fan(2));
    assert.strictEqual(board.posted.length, 0, 'dropping below the threshold takes it down');

    g.selfRoles.reactions[msg.id] = { channel: ch.id, map: { '🎮': 'gamer-role' } };
    const reactor = fakeMember(guild);
    await addEvent.run(client, { partial: false, emoji: { name: '🎮', id: null }, message: msg, users: { fetch: async () => new Collection() } }, { id: reactor.id, bot: false });
    assert.deepStrictEqual(reactor.roles.added, ['gamer-role']);
    console.log('✔ starboard posts at 2 stars and is removed below it; reaction role given on 🎮');
  }

  // 9. Scheduler: due one-off posts once and is removed, repeats move forward without a backlog
  {
    const scheduler = require('../src/events/scheduler');
    const { guild, addChannel } = fakeGuild();
    const ch = addChannel('announcements');
    const c = { ...client, channels: { fetch: async (cid) => guild.channels.cache.get(cid) } };
    db.data.schedules.push({ id: 'once1', guildId: guild.id, channelId: ch.id, message: 'One time', next: Date.now() - 1000, every: null });
    db.data.schedules.push({ id: 'rep1', guildId: guild.id, channelId: ch.id, message: 'Daily', next: Date.now() - 3 * 86400_000 - 1000, every: 86400_000 });
    await scheduler.runSchedules(c);
    assert.strictEqual(ch.posted.length, 2, 'both should post exactly once');
    assert(!db.data.schedules.some((s) => s.id === 'once1'), 'one-off should be removed');
    const rep = db.data.schedules.find((s) => s.id === 'rep1');
    assert(rep.next > Date.now() && rep.next < Date.now() + 86400_000, 'repeat should move to the next future slot');
    console.log('✔ scheduler: one-off posted and removed; 3-day-late repeat posted once and moved forward');
  }

  // 10. Feed parsing for YouTube Atom, RSS and Twitch uptime
  {
    const feeds = require('../src/lib/feeds');
    const yt = `<feed><entry><id>yt:video:abc</id><yt:videoId>abc</yt:videoId><title>Big &amp; New</title><link rel="alternate" href="https://www.youtube.com/watch?v=abc"/><author><name>Chan</name></author></entry></feed>`;
    const [v] = feeds.parseXml(yt);
    assert.deepStrictEqual([v.id, v.title, v.url, v.author], ['abc', 'Big & New', 'https://www.youtube.com/watch?v=abc', 'Chan']);
    const rss = `<rss><channel><item><title><![CDATA[Patch notes]]></title><link>https://blog.example/p1</link><guid>p1</guid></item></channel></rss>`;
    assert.strictEqual(feeds.parseXml(rss)[0].url, 'https://blog.example/p1');
    assert.strictEqual(feeds.parseUptime('1 hour, 2 minutes, 3 seconds'), 3723000);
    console.log('✔ feeds: YouTube Atom, RSS with CDATA and Twitch uptime parsed');
  }

  // 11. Backups only plan to add what's missing
  {
    const { diff } = require('../src/commands/backup');
    const { guild } = fakeGuild();
    guild.roles.cache.set('a', { name: 'Mod' });
    guild.channels.cache.set('c', { name: 'general', type: ChannelType.GuildText, parent: null });
    const data = {
      roles: [{ name: 'Mod' }, { name: 'VIP' }],
      channels: [
        { name: 'general', type: ChannelType.GuildText, parent: null },
        { name: 'memes', type: ChannelType.GuildText, parent: null },
      ],
    };
    const d = diff(guild, data);
    assert.deepStrictEqual([d.roles.map((r) => r.name), d.channels.map((c) => c.name)], [['VIP'], ['memes']]);
    console.log('✔ backup restore plans only the missing VIP role and #memes');
  }

  // 12. AI moderation replies
  {
    const guard = require('../src/ai/guard');
    assert.deepStrictEqual(guard.parse('safe'), { safe: true, codes: [] });
    assert.deepStrictEqual(guard.parse('unsafe\nS10,S1'), { safe: false, codes: ['S10', 'S1'] });
    console.log('✔ AI moderation: safe / unsafe with categories parsed');
  }

  // 13. Data survives a save and reload through SQLite
  {
    db.flush();
    if (db.driver() === 'sqlite') {
      const { DatabaseSync } = require('node:sqlite');
      const conn = new DatabaseSync(process.env.DB_PATH);
      const n = conn.prepare("SELECT COUNT(*) AS n FROM docs WHERE kind = 'guild'").get().n;
      assert(n >= 5, `expected guild rows in SQLite, found ${n}`);
      console.log(`✔ storage: ${n} guild rows written to SQLite`);
    } else console.log('• storage: this Node has no built-in SQLite, JSON fallback in use');
  }

  await tick();
  console.log('✔ all feature checks passed');
  process.exit(0);
})().catch((e) => {
  console.error('✘', e.stack || e.message);
  process.exit(1);
});
