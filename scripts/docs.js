// Writes COMMANDS.md: every command, grouped by category, with its aliases, slash command and
// required permissions. Run it after adding or renaming commands: `npm run docs`.
const fs = require('fs');
const path = require('path');
const { PermissionsBitField } = require('discord.js');
const { loadCommands, slashLabel } = require('../src/lib/registry');

const { commands, aliases } = loadCommands();

const aliasesOf = new Map();
for (const [alias, name] of aliases) {
  if (!aliasesOf.has(name)) aliasesOf.set(name, []);
  aliasesOf.get(name).push(alias);
}

const byCategory = new Map();
for (const cmd of commands.values()) {
  if (!byCategory.has(cmd.category)) byCategory.set(cmd.category, []);
  byCategory.get(cmd.category).push(cmd);
}

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const permLabel = (p) =>
  p?.length
    ? new PermissionsBitField(p)
        .toArray()
        .map((x) => x.replace(/([a-z])([A-Z])/g, '$1 $2'))
        .join(', ')
    : '—';

const slashCount = [...commands.values()].filter((c) => slashLabel(c.name)).length;
const out = [
  '# All commands',
  '',
  `Every one of the bot's **${commands.size}** commands works with the prefix (\`s!\` by default, or whatever a server sets).`,
  `The **${slashCount}** with a slash name also work as \`/commands\`; the rest are prefix-only to stay inside Discord's 100-command limit.`,
  '',
  'Arguments shown in the options column are what the command expects, in order. Aliases are the short forms that do the same thing.',
  '',
  '> Generated from `src/commands/` by `npm run docs` — do not edit by hand.',
  '',
  '## Contents',
  '',
];

for (const [cat, list] of [...byCategory].sort()) out.push(`- [${cat}](#${cat}) (${list.length})`);
out.push('');

for (const [cat, list] of [...byCategory].sort()) {
  out.push(`## ${cat}`, '');
  out.push('| Command | Aliases | Options | Slash | Needs | What it does |');
  out.push('|---|---|---|---|---|---|');
  for (const cmd of list.sort((a, b) => a.name.localeCompare(b.name))) {
    const opts = (cmd.options || []).map((o) => `${o.name}${o.required ? '' : '?'}`).join(', ');
    out.push(
      `| \`${cmd.name}\` | ${cell((aliasesOf.get(cmd.name) || []).map((a) => `\`${a}\``).join(', ')) || '—'} | ${cell(opts) || '—'} | ${cell(slashLabel(cmd.name)) || '—'} | ${cell(permLabel(cmd.perms))} | ${cell(cmd.description)} |`,
    );
  }
  out.push('');
}

out.push(
  '## Owner-only commands',
  '',
  'These only answer to the IDs in `OWNER_IDS`, and the AI staff never sees them.',
  '',
);
const owners = [...commands.values()].filter((c) => c.ownerOnly);
out.push(owners.length ? owners.map((c) => `- \`${c.name}\` — ${c.description}`).join('\n') : 'None.');
out.push('');

const file = path.join(__dirname, '..', 'COMMANDS.md');
fs.writeFileSync(file, out.join('\n'));
console.log(`✔ wrote COMMANDS.md — ${commands.size} commands in ${byCategory.size} categories`);
