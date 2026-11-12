// Offline checks: every command loads, names/aliases are unique, exactly 100 valid slash payloads,
// and a batch of pure commands actually run through a mock context and produce Components V2 output.
const assert = require('assert');
const { loadCommands, slashCommands } = require('../src/lib/registry');
const { parsePrefix } = require('../src/lib/args');
const { normalize } = require('../src/lib/context');

(async () => {
  const { commands, aliases } = loadCommands();
  const slash = slashCommands(commands);
  assert.strictEqual(slash.length, 100, `expected 100 slash commands, got ${slash.length}`);
  assert(commands.size >= 500, `expected 500+ prefix commands, got ${commands.size}`);
  for (const s of slash)
    assert(s.options.length <= 25 && s.description.length <= 100, `bad slash payload ${s.name}`);

  const cats = {};
  for (const c of commands.values()) cats[c.category] = (cats[c.category] || 0) + 1;
  console.log(`✔ ${commands.size} prefix commands, ${aliases.size} aliases, ${slash.length} slash commands`);
  console.log(
    '  ' +
      Object.entries(cats)
        .sort()
        .map(([k, v]) => `${k}:${v}`)
        .join('  '),
  );

  // Smoke-run offline commands (no network, no guild).
  const user = {
    id: '1',
    username: 'tester',
    displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png',
  };
  const runs = [
    ['calc', '2^10 + sqrt(16) * 3!'],
    ['add', '2 3'],
    ['quadratic', '1 -3 2'],
    ['roman', '2026'],
    ['unroman', 'MMXXVI'],
    ['primefactors', '360'],
    ['convert', '10 km mi'],
    ['c2f', '100'],
    ['age', '2000-01-01'],
    ['weekday', '2026-12-25'],
    ['datediff', '2026-01-01 2026-12-31'],
    ['reverse', 'hello world'],
    ['morse', 'sos'],
    ['base64', 'hello'],
    ['caesar', '3 abc'],
    ['owo', 'hello there'],
    ['upsidedown', 'hello'],
    ['8ball', 'will it work?'],
    ['coinflip', ''],
    ['roll', ''],
    ['choose', 'a, b, c'],
    ['password', '24'],
    ['uuid', '2'],
    ['shuffle', 'a, b, c'],
    ['md5', 'abc'],
    ['sha256', 'abc'],
    ['json', '{"a":1}'],
    ['httpstatus', '404'],
    ['snowflake', '175928847299117063'],
    ['color', '#ff0055'],
    ['palette', 'coral'],
    ['help', ''],
    ['help', 'calc'],
    ['categories', ''],
    ['slashlist', ''],
    ['tip', '100 15 4'],
    ['loan', '100000 8 5'],
    ['bmi', '70 175'],
  ];
  const ctx = {
    isSlash: false,
    user,
    guild: null,
    channel: { sendTyping: async () => {} },
    prefix: '!',
    client: { commands, aliases, users: { fetch: async () => null } },
  };
  let ok = 0;
  for (const [name, raw] of runs) {
    const cmd = commands.get(name);
    assert(cmd, `missing ${name}`);
    const args = await parsePrefix(ctx, cmd, raw);
    const out = normalize(await cmd.run(ctx, args));
    assert(out.components?.length && out.flags & (1 << 15), `${name} did not return a Components V2 payload`);
    out.components.forEach((c) => c.toJSON());
    ok++;
  }
  console.log(`✔ ${ok} commands executed offline and rendered valid Components V2 containers`);
})().catch((e) => {
  console.error('✖', e);
  process.exit(1);
});
