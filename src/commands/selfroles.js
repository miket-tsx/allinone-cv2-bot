const { PermissionFlagsBits: P, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const db = require('../lib/db');
const { card, ok, C } = require('../lib/ui');
const { assert, chunk, emojiKey, UserError } = require('../lib/util');

const admin = { guildOnly: true, perms: [P.ManageRoles], botPerms: [P.ManageRoles] };
const eph = (p) => ({ ...p, flags: (p.flags || 0) | MessageFlags.Ephemeral });
const store = (guild) => db.guild(guild.id).selfRoles;


function render(panel) {
  const buttons = panel.roles.map((r) => {
    const b = new ButtonBuilder().setCustomId(`rolepanel:${r.id}`).setLabel(r.label.slice(0, 80)).setStyle(ButtonStyle.Secondary);
    if (r.emoji) b.setEmoji(r.emoji);
    return b;
  });
  return card({
    title: panel.title,
    description:
      (panel.description || 'Press a button to get the role, press it again to drop it.') +
      (panel.single ? '\n-# You can only hold one role from this panel.' : ''),
    color: C.primary,
    rows: chunk(buttons, 5).map((row) => new ActionRowBuilder().addComponents(row)),
  });
}

async function findPanel(ctx, id) {
  const panel = store(ctx.guild).panels[id];
  assert(panel, `No role panel with ID \`${id}\`. The ID is the panel message's ID, and \`rolepanels\` lists them.`);
  const msg = await ctx.guild.channels.cache.get(panel.channelId)?.messages.fetch(id).catch(() => null);
  assert(msg, 'That panel message is gone. Delete it with `rolepaneldelete` and make a new one.');
  return { panel, msg };
}

function checkRole(ctx, role) {
  assert(!role.managed && role.id !== ctx.guild.id, `${role.name} is managed by Discord or an integration, so nobody can pick it.`);
  assert(role.editable, `${role.name} sits above my highest role, so I can't hand it out.`);
  assert(ctx.member.id === ctx.guild.ownerId || role.position < ctx.member.roles.highest.position, `${role.name} is above your own top role.`);
  const risky = ['Administrator', 'ManageGuild', 'ManageRoles', 'BanMembers', 'KickMembers', 'ManageChannels'].filter((p) => role.permissions.has(p));
  assert(!risky.length, `${role.name} has ${risky.join(', ')}. Letting anyone grab that would be a bad time.`);
}

module.exports = [
  {
    name: 'rolepanel',
    description: 'Post a self-role panel with buttons (add roles with rolepaneladd)',
    ...admin,
    options: [
      { name: 'channel', type: 'channel', required: true, description: 'Where to post it' },
      { name: 'title', type: 'string', required: true, description: 'Panel title, e.g. "Pick your pings"' },
    ],
    async run(ctx, a) {
      assert(a.channel.isTextBased(), 'Pick a text channel.');
      const panel = { channelId: a.channel.id, title: a.title.slice(0, 200), roles: [], single: false };
      const msg = await a.channel.send(card({ title: panel.title, description: '*No roles yet. Add some with `rolepaneladd`.*' }));
      store(ctx.guild).panels[msg.id] = panel;
      db.save();
      return ok(`Panel posted in ${a.channel}. Its ID is \`${msg.id}\`.\nAdd roles with \`rolepaneladd ${msg.id} @role 🎮 Gamer\`.`);
    },
    async onComponent(i, [roleId]) {
      const panel = store(i.guild).panels[i.message.id];
      if (!panel?.roles.some((r) => r.id === roleId))
        return i.reply(eph(card({ description: "That button isn't hooked up anymore.", color: C.warn })));
      const role = i.guild.roles.cache.get(roleId);
      if (!role) return i.reply(eph(card({ description: 'That role was deleted.', color: C.warn })));
      const has = i.member.roles.cache.has(roleId);
      if (has) await i.member.roles.remove(role, 'Self role');
      else {
        if (panel.single) {
          const others = panel.roles.map((r) => r.id).filter((id) => id !== roleId && i.member.roles.cache.has(id));
          if (others.length) await i.member.roles.remove(others, 'Self role swap');
        }
        await i.member.roles.add(role, 'Self role');
      }
      return i.reply(eph(card({ description: has ? `Removed **${role.name}**.` : `You've got **${role.name}** now.`, color: has ? C.warn : C.success })));
    },
  },
  {
    name: 'rolepaneladd',
    description: 'Add a role button to a panel',
    ...admin,
    options: [
      { name: 'panel', type: 'string', required: true, description: 'Panel message ID', rest: false },
      { name: 'role', type: 'role', required: true, description: 'Role to hand out' },
      { name: 'emoji', type: 'string', description: 'Button emoji', rest: false },
      { name: 'label', type: 'string', description: 'Button text (defaults to the role name)' },
    ],
    async run(ctx, a) {
      const { panel, msg } = await findPanel(ctx, a.panel);
      checkRole(ctx, a.role);
      assert(panel.roles.length < 25, 'A panel holds 25 buttons at most. Make another panel.');
      assert(!panel.roles.some((r) => r.id === a.role.id), 'That role is already on the panel.');
      // An emoji that isn't one gets folded into the label instead of breaking the button
      const emoji = a.emoji && /^(<a?:\w+:\d+>|\p{Extended_Pictographic}.*)$/u.test(a.emoji) ? a.emoji : null;
      const label = [!emoji && a.emoji, a.label].filter(Boolean).join(' ') || a.role.name;
      panel.roles.push({ id: a.role.id, label, emoji });
      await msg.edit(render(panel));
      db.save();
      return ok(`Added **${a.role.name}** to the panel.`);
    },
  },
  {
    name: 'rolepanelremove',
    description: 'Take a role button off a panel',
    ...admin,
    options: [
      { name: 'panel', type: 'string', required: true, description: 'Panel message ID', rest: false },
      { name: 'role', type: 'role', required: true, description: 'Role to remove' },
    ],
    async run(ctx, a) {
      const { panel, msg } = await findPanel(ctx, a.panel);
      panel.roles = panel.roles.filter((r) => r.id !== a.role.id);
      await msg.edit(panel.roles.length ? render(panel) : card({ title: panel.title, description: '*No roles yet.*' }));
      db.save();
      return ok(`Removed **${a.role.name}** from the panel.`);
    },
  },
  {
    name: 'rolepanelsingle',
    description: 'Make a panel "pick one" (like colour roles) or "pick any"',
    ...admin,
    options: [
      { name: 'panel', type: 'string', required: true, description: 'Panel message ID', rest: false },
      { name: 'single', type: 'boolean', required: true, description: 'true = only one role at a time' },
    ],
    async run(ctx, a) {
      const { panel, msg } = await findPanel(ctx, a.panel);
      panel.single = a.single;
      if (panel.roles.length) await msg.edit(render(panel));
      db.save();
      return ok(a.single ? 'People can only hold one role from that panel now.' : 'People can pick as many as they like.');
    },
  },
  {
    name: 'rolepaneldelete',
    description: 'Delete a role panel',
    ...admin,
    options: [{ name: 'panel', type: 'string', required: true, description: 'Panel message ID' }],
    async run(ctx, a) {
      const panel = store(ctx.guild).panels[a.panel];
      assert(panel, 'No panel with that ID.');
      await ctx.guild.channels.cache.get(panel.channelId)?.messages.delete(a.panel).catch(() => {});
      delete store(ctx.guild).panels[a.panel];
      db.save();
      return ok('Panel deleted.');
    },
  },
  {
    name: 'rolepanels',
    description: 'List the role panels and reaction roles in this server',
    ...admin,
    run(ctx) {
      const s = store(ctx.guild);
      const panels = Object.entries(s.panels).map(([id, p]) => `\`${id}\` in <#${p.channelId}>: **${p.title}** (${p.roles.length} roles${p.single ? ', pick one' : ''})`);
      const reactions = Object.entries(s.reactions).map(
        ([id, r]) => `[message](https://discord.com/channels/${ctx.guild.id}/${r.channelId}/${id}): ${Object.entries(r.map).map(([e, role]) => `${/^\d+$/.test(e) ? `<:e:${e}>` : e} → <@&${role}>`).join(', ')}`,
      );
      return card({
        title: 'Self roles',
        fields: [
          ['Button panels', panels.join('\n') || 'None'],
          ['Reaction roles', reactions.join('\n') || 'None'],
        ],
      });
    },
  },
  {
    name: 'reactionrole',
    description: 'React to a message with an emoji to get a role (old-school style)',
    ...admin,
    botPerms: [P.ManageRoles, P.AddReactions],
    options: [
      { name: 'message', type: 'string', required: true, description: 'Message ID (in this channel) or message link', rest: false },
      { name: 'emoji', type: 'string', required: true, description: 'Emoji to react with', rest: false },
      { name: 'role', type: 'role', required: true, description: 'Role it gives' },
    ],
    async run(ctx, a) {
      const [, chId, msgId] = a.message.match(/channels\/\d+\/(\d+)\/(\d+)/) || [null, ctx.channel.id, a.message];
      const msg = await ctx.guild.channels.cache.get(chId)?.messages.fetch(msgId).catch(() => null);
      assert(msg, "Couldn't find that message. Use a message link if it's in another channel.");
      checkRole(ctx, a.role);
      await msg.react(a.emoji).catch(() => {
        throw new UserError("I can't use that emoji. It has to be a normal emoji or one from this server.");
      });
      const r = (store(ctx.guild).reactions[msg.id] ??= { channelId: msg.channel.id, map: {} });
      r.map[emojiKey(a.emoji)] = a.role.id;
      db.save();
      return ok(`Reacting with ${a.emoji} on that message now gives **${a.role.name}**.`);
    },
  },
  {
    name: 'reactionroleremove',
    description: 'Remove a reaction role from a message',
    ...admin,
    options: [
      { name: 'message', type: 'string', required: true, description: 'Message ID or link', rest: false },
      { name: 'emoji', type: 'string', required: true, description: 'Emoji' },
    ],
    run(ctx, a) {
      const id = a.message.split('/').pop();
      const r = store(ctx.guild).reactions[id];
      assert(r?.map[emojiKey(a.emoji)], 'No reaction role like that on that message.');
      delete r.map[emojiKey(a.emoji)];
      if (!Object.keys(r.map).length) delete store(ctx.guild).reactions[id];
      db.save();
      return ok('Removed.');
    },
  },
];
