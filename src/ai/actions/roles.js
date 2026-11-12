const { PermissionFlagsBits: P } = require('discord.js');
const r = require('../resolve');

const roleLine = (role) => `${role.name} (${role.members.size} members, ${role.hexColor})`;

module.exports = [
  {
    name: 'list_roles',
    description: 'List every role in the server, highest first',
    params: {},
    run: (env) =>
      env.guild.roles.cache
        .sort((a, b) => b.position - a.position)
        .map(roleLine)
        .join('\n'),
  },
  {
    name: 'role_info',
    description: 'Details about one role: colour, permissions, member count, position',
    params: { role: 's! Role name, mention or ID' },
    run: (env, a) => {
      const role = r.role(env, a.role);
      return [
        roleLine(role),
        `position ${role.position}, hoisted: ${role.hoist}, mentionable: ${role.mentionable}`,
        `permissions: ${role.permissions.toArray().join(', ') || 'none'}`,
      ].join('\n');
    },
  },
  {
    name: 'list_role_members',
    description: 'List the members who have a role',
    params: { role: 's! Role name, mention or ID' },
    run: (env, a) => {
      const role = r.role(env, a.role);
      const names = role.members.map((m) => m.user.username);
      return names.length
        ? `${names.length} members: ${names.slice(0, 60).join(', ')}`
        : 'Nobody has that role.';
    },
  },
  {
    name: 'create_role',
    description: 'Create a new role',
    params: {
      name: 's! Role name',
      color: 's Hex colour like #ff8800 or a colour name',
      permissions: 's Comma separated permission names, e.g. ManageMessages,KickMembers',
      hoist: 'b Show members separately in the member list',
      mentionable: 'b Let anyone mention this role',
    },
    perms: [P.ManageRoles],
    confirm: true,
    async run(env, a) {
      const permissions = r.perms(a.permissions);
      // Nobody gets to hand out permissions they don't have themselves
      const missing = permissions.filter((p) => !env.member.permissions.has(P[p]));
      if (missing.length) return `Skipped: you don't have ${missing.join(', ')} yourself.`;
      const role = await env.guild.roles.create({
        name: a.name,
        color: r.color(a.color),
        permissions,
        hoist: !!a.hoist,
        mentionable: !!a.mentionable,
        reason: env.reason,
      });
      return `Created role ${role.name}.`;
    },
  },
  {
    name: 'delete_role',
    description: 'Delete a role',
    params: { role: 's! Role name, mention or ID' },
    perms: [P.ManageRoles],
    confirm: true,
    danger: true,
    async run(env, a) {
      const role = r.role(env, a.role);
      r.assertRoleEditable(env, role);
      await role.delete(env.reason);
      return `Deleted role ${role.name}.`;
    },
  },
  {
    name: 'rename_role',
    description: 'Rename a role',
    params: { role: 's! Role to rename', name: 's! New name' },
    perms: [P.ManageRoles],
    confirm: true,
    async run(env, a) {
      const role = r.role(env, a.role);
      r.assertRoleEditable(env, role);
      const old = role.name;
      await role.setName(a.name, env.reason);
      return `Renamed ${old} to ${a.name}.`;
    },
  },
  {
    name: 'set_role_color',
    description: "Change a role's colour",
    params: { role: 's! Role', color: 's! Hex colour or colour name' },
    perms: [P.ManageRoles],
    confirm: true,
    async run(env, a) {
      const role = r.role(env, a.role);
      r.assertRoleEditable(env, role);
      await role.setColor(r.color(a.color), env.reason);
      return `${role.name} is now ${a.color}.`;
    },
  },
  {
    name: 'set_role_permissions',
    description: "Replace a role's permissions entirely",
    params: { role: 's! Role', permissions: 's! Comma separated permission names, or "none"' },
    perms: [P.ManageRoles],
    confirm: true,
    danger: true,
    async run(env, a) {
      const role = r.role(env, a.role);
      r.assertRoleEditable(env, role);
      const list = /^none$/i.test(a.permissions) ? [] : r.perms(a.permissions);
      const missing = list.filter((p) => !env.member.permissions.has(P[p]));
      if (missing.length) return `Skipped: you don't have ${missing.join(', ')} yourself.`;
      await role.setPermissions(list, env.reason);
      return `${role.name} now has: ${list.join(', ') || 'no permissions'}.`;
    },
  },
  {
    name: 'add_role_permissions',
    description: 'Give a role extra permissions, keeping the ones it has',
    params: { role: 's! Role', permissions: 's! Comma separated permission names' },
    perms: [P.ManageRoles],
    confirm: true,
    async run(env, a) {
      const role = r.role(env, a.role);
      r.assertRoleEditable(env, role);
      const list = r.perms(a.permissions);
      const missing = list.filter((p) => !env.member.permissions.has(P[p]));
      if (missing.length) return `Skipped: you don't have ${missing.join(', ')} yourself.`;
      await role.setPermissions(role.permissions.add(list), env.reason);
      return `Added ${list.join(', ')} to ${role.name}.`;
    },
  },
  {
    name: 'remove_role_permissions',
    description: 'Take permissions away from a role',
    params: { role: 's! Role', permissions: 's! Comma separated permission names' },
    perms: [P.ManageRoles],
    confirm: true,
    async run(env, a) {
      const role = r.role(env, a.role);
      r.assertRoleEditable(env, role);
      const list = r.perms(a.permissions);
      await role.setPermissions(role.permissions.remove(list), env.reason);
      return `Removed ${list.join(', ')} from ${role.name}.`;
    },
  },
  {
    name: 'set_role_display',
    description: 'Set whether a role is shown separately and whether it can be mentioned',
    params: {
      role: 's! Role',
      hoist: 'b Show separately in the member list',
      mentionable: 'b Allow mentions',
    },
    perms: [P.ManageRoles],
    confirm: true,
    async run(env, a) {
      const role = r.role(env, a.role);
      r.assertRoleEditable(env, role);
      await role.edit({
        hoist: a.hoist ?? role.hoist,
        mentionable: a.mentionable ?? role.mentionable,
        reason: env.reason,
      });
      return `Updated ${role.name}.`;
    },
  },
  {
    name: 'move_role',
    description: 'Move a role to sit directly above or below another role',
    params: {
      role: 's! Role to move',
      target: 's! Role to position it next to',
      where: 's! "above" or "below"',
    },
    perms: [P.ManageRoles],
    confirm: true,
    async run(env, a) {
      const role = r.role(env, a.role);
      const target = r.role(env, a.target);
      r.assertRoleEditable(env, role);
      const position = a.where === 'below' ? Math.max(1, target.position) : target.position + 1;
      await role.setPosition(position, { reason: env.reason });
      return `Moved ${role.name} ${a.where} ${target.name}.`;
    },
  },
  {
    name: 'give_role',
    description: 'Give a role to a member',
    params: { member: 's! Member name, mention or ID', role: 's! Role' },
    perms: [P.ManageRoles],
    confirm: true,
    async run(env, a) {
      const m = await r.member(env, a.member);
      const role = r.role(env, a.role);
      r.assertRoleEditable(env, role);
      await m.roles.add(role, env.reason);
      return `Gave ${role.name} to ${m.user.username}.`;
    },
  },
  {
    name: 'take_role',
    description: 'Remove a role from a member',
    params: { member: 's! Member name, mention or ID', role: 's! Role' },
    perms: [P.ManageRoles],
    confirm: true,
    async run(env, a) {
      const m = await r.member(env, a.member);
      const role = r.role(env, a.role);
      r.assertRoleEditable(env, role);
      await m.roles.remove(role, env.reason);
      return `Took ${role.name} from ${m.user.username}.`;
    },
  },
  {
    name: 'mass_give_role',
    description: 'Give a role to everyone, only humans, or only bots',
    params: { role: 's! Role', who: 's! "everyone", "humans" or "bots"' },
    perms: [P.ManageRoles, P.Administrator],
    confirm: true,
    danger: true,
    async run(env, a) {
      const role = r.role(env, a.role);
      r.assertRoleEditable(env, role);
      const members = await env.guild.members.fetch();
      const targets = members.filter(
        (m) =>
          !m.roles.cache.has(role.id) &&
          (a.who === 'bots' ? m.user.bot : a.who === 'humans' ? !m.user.bot : true),
      );
      let done = 0;
      for (const m of targets.values()) if (await m.roles.add(role, env.reason).catch(() => null)) done++;
      return `Gave ${role.name} to ${done} of ${targets.size} members.`;
    },
  },
  {
    name: 'mass_take_role',
    description: 'Remove a role from everyone who has it',
    params: { role: 's! Role' },
    perms: [P.ManageRoles, P.Administrator],
    confirm: true,
    danger: true,
    async run(env, a) {
      const role = r.role(env, a.role);
      r.assertRoleEditable(env, role);
      await env.guild.members.fetch();
      let done = 0;
      for (const m of role.members.values())
        if (await m.roles.remove(role, env.reason).catch(() => null)) done++;
      return `Removed ${role.name} from ${done} members.`;
    },
  },
];
