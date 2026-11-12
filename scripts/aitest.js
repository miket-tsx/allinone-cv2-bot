// Offline checks for the AI staff. Groq and Discord are both faked, so this runs without
// any keys, and proves the routing, permission checks, confirm flow and command bridge work.
process.env.DB_FILE = require('path').join(require('os').tmpdir(), `aitest-${process.pid}.json`);
process.env.DB_PATH = require('path').join(require('os').tmpdir(), `aitest-${process.pid}.sqlite`);
process.env.GROQ_API_KEY = 'test-key';

const assert = require('assert');
const { Collection, PermissionsBitField, PermissionFlagsBits: P } = require('discord.js');
const { loadCommands } = require('../src/lib/registry');
const caps = require('../src/ai/capabilities');
const agent = require('../src/ai/agent');

// --- fake Groq: replays a script of responses and records what it was sent ---
let script = [];
const sentToGroq = [];
global.fetch = async (url, init) => {
  assert(url.includes('api.groq.com'), `unexpected fetch to ${url}`);
  const body = JSON.parse(init.body);
  sentToGroq.push(body);
  const next = script.shift();
  assert(next, 'Groq was called more times than the test expected');
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: next }] }),
    text: async () => '',
  };
};
const toolCall = (name, args, id = name) => ({
  id,
  type: 'function',
  function: { name, arguments: JSON.stringify(args) },
});

// --- fake Discord server ---
function fakeGuild() {
  const roles = new Collection();
  const guild = {
    id: '100000000000000001',
    name: 'Test Den',
    ownerId: '999',
    roles: null,
    channels: { cache: new Collection() },
  };
  const addRole = (id, name, position, perms = []) => {
    const role = {
      id,
      name,
      position,
      managed: false,
      hoist: false,
      mentionable: false,
      hexColor: '#000000',
      members: new Collection(),
      permissions: new PermissionsBitField(perms),
      delete: async () => roles.delete(id),
    };
    roles.set(id, role);
    return role;
  };
  addRole(guild.id, '@everyone', 0);
  const botRole = addRole('200000000000000001', 'Slash', 10, [P.Administrator]);
  const modRole = addRole('200000000000000002', 'Mod', 5, [P.ManageRoles, P.ManageMessages]);
  guild.roles = {
    cache: roles,
    get everyone() {
      return roles.get(guild.id);
    },
    create: async (o) => addRole(String(300000000000000000n + BigInt(roles.size)), o.name, 1, o.permissions),
  };
  guild.members = { me: { roles: { highest: botRole } }, fetch: async () => null };
  return { guild, modRole };
}

let nextUser = 0;
function fakeMessage(guild, perms, highest) {
  const replies = [];
  const channel = {
    id: '400000000000000001',
    name: 'general',
    sendTyping: async () => {},
    send: async (p) => p,
  };
  const member = {
    id: String(500000000000000000n + BigInt(++nextUser)), // fresh user each test dodges the AI cooldown
    displayName: 'Tester',
    user: { username: 'tester' },
    permissions: new PermissionsBitField(perms),
    roles: { highest, cache: new Collection() },
  };
  guild.members.fetch = async () => member;
  let click = null;
  const message = {
    guild,
    channel,
    member,
    attachments: new Collection(),
    author: { id: member.id, username: 'tester', bot: false },
    reply: async (p) => {
      const sent = {
        payload: p,
        edit: async (q) => replies.push(q),
        awaitMessageComponent: async () => (Array.isArray(click) ? click.shift() : click),
      };
      replies.push(p);
      return sent;
    },
  };
  return { message, replies, setClick: (c) => (click = c) };
}

const client = { user: { id: '600000000000000001', username: 'Slash' } };

(async () => {
  const { commands } = loadCommands();
  client.commands = commands;
  const cat = caps.build(commands);

  // 1. Catalogue shape
  const ownerOnly = [...commands.values()].filter((c) => c.ownerOnly).length;
  assert(cat.actions.size >= 100, `expected at least 100 server actions, got ${cat.actions.size}`);
  assert.strictEqual(cat.total, cat.actions.size + commands.size, 'every action and command should be a capability');
  assert(cat.total >= 691, `capabilities went down to ${cat.total}`);
  for (const a of cat.actions.values()) {
    assert(/^[a-z_]{3,64}$/.test(a.name), `bad tool name ${a.name}`);
    assert(a.description.length <= 200, `${a.name} description too long`);
    assert(typeof a.run === 'function', `${a.name} has no run()`);
    if (a.danger) assert(a.confirm, `${a.name} is dangerous but doesn't ask for confirmation`);
  }
  // Worst case tool count for one request must stay well under Groq's limit
  const sizes = [...cat.groups.values()]
    .map((g) => g.actions.length + (g.commands.length ? 1 : 0))
    .sort((x, y) => y - x);
  const worst = sizes.slice(0, 4).reduce((s, n) => s + n, 0);
  assert(worst <= 128, `worst-case request would send ${worst} tools`);
  console.log(
    `✔ ${cat.total} capabilities: ${cat.actions.size} server actions + ${commands.size} commands (${ownerOnly} owner-only, hidden from the AI) in ${cat.groups.size} groups`,
  );
  console.log(`  worst-case tools in one request: ${worst}`);

  // 2. "make some basic roles": router -> tool calls -> plan -> confirm -> roles exist
  {
    const { guild, modRole } = fakeGuild();
    const { message, replies, setClick } = fakeMessage(guild, [P.ManageRoles], modRole);
    script = [
      { content: '{"groups":["roles"]}' },
      {
        content: null,
        tool_calls: [
          toolCall('list_roles', {}, 'a'),
          toolCall('create_role', { name: 'Member', color: 'blue' }, 'b'),
          toolCall('create_role', { name: 'VIP', color: 'gold', hoist: true }, 'c'),
          toolCall('create_role', { name: 'Helper', color: 'green', permissions: 'ManageMessages' }, 'd'),
        ],
      },
      { content: "I'll set up Member, VIP and Helper for you." },
    ];
    let updated = null;
    setClick({
      customId: 'aistaff:confirm',
      user: { id: message.author.id },
      update: async (p) => (updated = p),
    });
    await agent.handle(client, message, 'hey, can you make some basic roles');

    const toolsSent = sentToGroq[1].tools.map((t) => t.function.name);
    assert(
      toolsSent.includes('create_role') && !toolsSent.includes('ban_member'),
      'router should limit tools to the roles group',
    );
    const listResult = sentToGroq[2].messages.find((m) => m.tool_call_id === 'a').content;
    assert(listResult.includes('Mod'), 'read-only tool should run immediately');
    const queued = sentToGroq[2].messages.find((m) => m.tool_call_id === 'b').content;
    assert(queued.startsWith('Queued'), 'create_role must wait for confirmation');
    assert(updated, 'confirm click should update the card');
    for (const n of ['Member', 'VIP'])
      assert(
        guild.roles.cache.some((r) => r.name === n),
        `${n} was not created`,
      );
    // Helper asks for ManageMessages, which the requester doesn't have, so it must be refused
    assert(
      !guild.roles.cache.some((r) => r.name === 'Helper'),
      'Helper should be refused: requester lacks ManageMessages',
    );
    const final = JSON.stringify(replies.at(-1));
    assert(
      final.includes('Created role Member') && final.includes("you don't have ManageMessages"),
      'final card should list results',
    );
    console.log(
      '✔ "make some basic roles": planned 3, confirmed, created 2, refused 1 the user had no right to grant',
    );
  }

  // 3. Someone without permissions gets told no, and nothing is queued
  {
    const { guild } = fakeGuild();
    const { message, replies } = fakeMessage(guild, [], guild.roles.everyone);
    script = [
      { content: '{"groups":["roles"]}' },
      { content: null, tool_calls: [toolCall('delete_role', { role: 'Mod' }, 'x')] },
      { content: "Sorry, you'd need Manage Roles for that." },
    ];
    sentToGroq.length = 0;
    await agent.handle(client, message, 'delete the mod role');
    const res = sentToGroq[2].messages.find((m) => m.tool_call_id === 'x').content;
    assert(res.startsWith('Not allowed'), 'delete_role should be refused');
    assert(
      guild.roles.cache.some((r) => r.name === 'Mod'),
      'Mod role must still exist',
    );
    assert(!JSON.stringify(replies).includes('aistaff:confirm'), 'no confirm button should be shown');
    console.log('✔ no permission: refused before queueing, nothing deleted');
  }

  // 4. Cancel leaves the server untouched
  {
    const { guild, modRole } = fakeGuild();
    const { message, setClick } = fakeMessage(guild, [P.ManageRoles], modRole);
    script = [
      { content: '{"groups":["roles"]}' },
      { content: null, tool_calls: [toolCall('create_role', { name: 'Ghost' })] },
      { content: 'Creating Ghost.' },
    ];
    let updated = null;
    setClick({
      customId: 'aistaff:cancel',
      user: { id: message.author.id },
      update: async (p) => (updated = p),
    });
    await agent.handle(client, message, 'make a ghost role');
    assert(
      !guild.roles.cache.some((r) => r.name === 'Ghost') && JSON.stringify(updated).includes('Cancelled'),
    );
    console.log('✔ cancel: nothing created');
  }

  // 5. Bridge to existing commands: the AI runs !calc through the normal handler
  {
    const { guild, modRole } = fakeGuild();
    const { message, replies } = fakeMessage(guild, [], modRole);
    script = [
      { content: '{"groups":["cmd_math"]}' },
      {
        content: null,
        tool_calls: [toolCall('run_math_command', { command: 'calc', args: '12 * 12' }, 'm')],
      },
      { content: '12 times 12 is 144.' },
    ];
    sentToGroq.length = 0;
    await agent.handle(client, message, 'what is 12 times 12');
    const res = sentToGroq[2].messages.find((m) => m.tool_call_id === 'm').content;
    assert(res.includes('144'), `calc should return 144, got: ${res}`);
    assert(
      sentToGroq[1].messages[0].content.includes('calc'),
      'command catalogue should be in the system prompt',
    );
    assert(JSON.stringify(replies.at(-1)).includes('144'));
    console.log('✔ command bridge: AI ran !calc through the regular handler and got 144');
  }

  // 6. A big plan is confirmed in batches of 8, and "Stop here" skips the rest
  {
    const { guild, modRole } = fakeGuild();
    const { message, replies, setClick } = fakeMessage(guild, [P.ManageRoles], modRole);
    const calls = Array.from({ length: 12 }, (_, i) => toolCall('create_role', { name: `Team ${i + 1}` }, `t${i}`));
    script = [{ content: '{"groups":["roles"]}' }, { content: null, tool_calls: calls }, { content: 'Making 12 team roles.' }];
    const cards = [];
    setClick([
      { customId: 'aistaff:confirm', user: { id: message.author.id }, update: async (p) => cards.push(p) },
      { customId: 'aistaff:cancel', user: { id: message.author.id }, update: async (p) => cards.push(p) },
    ]);
    await agent.handle(client, message, 'make 12 team roles');
    const made = guild.roles.cache.filter((r) => r.name.startsWith('Team ')).size;
    assert.strictEqual(made, 8, `first batch should create 8 roles, made ${made}`);
    assert(JSON.stringify(replies[0]).includes('Do steps 1-8'), 'first card should offer steps 1-8');
    assert(JSON.stringify(replies).includes('Do steps 9-12'), 'second batch should be offered');
    assert(JSON.stringify(cards.at(-1)).includes('Stopped. 8 of 12'), 'stop should report 8 of 12');
    console.log('✔ chunked confirm: 12-step plan ran 8, offered 9-12, stopped cleanly');
  }

  // 7. "Do all" runs every remaining step after one click
  {
    const { guild, modRole } = fakeGuild();
    const { message, setClick } = fakeMessage(guild, [P.ManageRoles], modRole);
    const calls = Array.from({ length: 10 }, (_, i) => toolCall('create_role', { name: `Lvl ${i + 1}` }, `l${i}`));
    script = [{ content: '{"groups":["roles"]}' }, { content: null, tool_calls: calls }, { content: 'Ten level roles.' }];
    setClick([{ customId: 'aistaff:all', user: { id: message.author.id }, update: async () => {} }]);
    await agent.handle(client, message, 'make 10 level roles');
    assert.strictEqual(guild.roles.cache.filter((r) => r.name.startsWith('Lvl ')).size, 10);
    console.log('✔ chunked confirm: "Do all" ran all 10 after one click');
  }

  // 8. Images switch to the vision model and are sent as image parts
  {
    const { guild, modRole } = fakeGuild();
    const { message, replies } = fakeMessage(guild, [], modRole);
    message.attachments.set('1', { contentType: 'image/png', size: 1000, url: 'https://cdn.example/shot.png' });
    script = [{ content: '{"groups":[]}' }, { content: 'That screenshot shows a permissions error.' }];
    sentToGroq.length = 0;
    await agent.handle(client, message, 'what does this error mean?');
    const req = sentToGroq[1];
    assert.strictEqual(req.model, process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b', `vision request should use the vision model, got ${req.model}`);
    const parts = req.messages.at(-1).content;
    assert(Array.isArray(parts) && parts.some((p) => p.type === 'image_url' && p.image_url.url.includes('shot.png')), 'image should be attached');
    assert(JSON.stringify(replies.at(-1)).includes('permissions error'));
    console.log('✔ vision: image went to the vision model as an image part');
  }

  // 9. Memories and matching docs are in the system prompt
  {
    const knowledge = require('../src/ai/knowledge');
    const { guild, modRole } = fakeGuild();
    knowledge.remember(guild.id, 'The staff role is called Guardians', 'x');
    knowledge.addDoc(guild.id, 'Rules', 'Rule 1: be kind.\n\nRule 2: no advertising other servers in any channel.\n\nRule 3: English only in general.', 'x');
    knowledge.addDoc(guild.id, 'Events', 'Movie night is every Friday at 8pm in the cinema voice channel.', 'x');
    const { message } = fakeMessage(guild, [], modRole);
    script = [{ content: '{"groups":[]}' }, { content: 'Advertising is not allowed (Rules).' }];
    sentToGroq.length = 0;
    await agent.handle(client, message, 'can I advertise my server here?');
    const sys = sentToGroq[1].messages[0].content;
    assert(sys.includes('Guardians'), 'memory should be in the prompt');
    assert(sys.includes('no advertising'), 'matching doc should be in the prompt');
    assert(!sys.includes('Movie night'), 'unrelated doc should be left out');
    console.log('✔ memory and docs: remembered fact and the relevant doc section went into the prompt');
  }

  // 10. The prompt file's placeholders are filled and no leftover {{...}} reaches the model
  {
    const { guild, modRole } = fakeGuild();
    const { message } = fakeMessage(guild, [], modRole);
    script = [{ content: '{"groups":[]}' }, { content: 'Hey!' }];
    sentToGroq.length = 0;
    await agent.handle(client, message, 'hi');
    const sys = sentToGroq[1].messages[0].content;
    assert(!sys.includes('{{'), 'prompt placeholders should all be filled in');
    assert(sys.includes(guild.name), 'the prompt should know which server it is in');
    console.log('✔ prompt file: placeholders filled, server name included');
  }

  console.log('✔ all AI staff checks passed');
  process.exit(0);
})().catch((e) => {
  console.error('✘', e.message);
  process.exit(1);
});
