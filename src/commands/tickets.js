const { PermissionFlagsBits: P, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const db = require('../lib/db');
const { card, ok, C } = require('../lib/ui');
const { assert, ts, UserError } = require('../lib/util');
const tickets = require('../lib/tickets');

const admin = { guildOnly: true, perms: [P.ManageGuild] };
const eph = (p) => ({ ...p, flags: (p.flags || 0) | MessageFlags.Ephemeral });

function current(ctx) {
  const t = tickets.cfgOf(ctx.guild).open[ctx.channel.id];
  assert(t, 'Run this inside a ticket channel.');
  return t;
}
const staffOnly = (ctx) => assert(tickets.isStaff(ctx.member), 'Only staff can do that.');

module.exports = [
  {
    name: 'ticketsetup',
    description: 'Set up tickets: where they open, who answers them, where transcripts go',
    ...admin,
    botPerms: [P.ManageChannels],
    options: [
      { name: 'staff', type: 'role', required: true, description: 'Role that handles tickets' },
      { name: 'category', type: 'channel', description: 'Category new tickets go in' },
      { name: 'logs', type: 'channel', description: 'Where closed-ticket transcripts are saved' },
    ],
    async run(ctx, a) {
      const cfg = tickets.cfgOf(ctx.guild);
      let category = a.category;
      if (category) assert(category.type === ChannelType.GuildCategory, 'The category option needs a category, not a channel.');
      category ??= await ctx.guild.channels.create({ name: 'Tickets', type: ChannelType.GuildCategory });
      cfg.category = category.id;
      cfg.staffRoles = [a.staff.id];
      if (a.logs) cfg.logChannel = a.logs.id;
      db.save();
      return ok(
        `Tickets open in **${category.name}** and ${a.staff} handles them.` +
          (cfg.logChannel ? ` Transcripts go to <#${cfg.logChannel}>.` : ' Add a transcript channel with `ticketsetup` again, using the logs option.') +
          '\nNow post the button with `ticketpanel`.',
      );
    },
  },
  {
    name: 'ticketpanel',
    description: 'Post the "Open a ticket" panel',
    ...admin,
    options: [
      { name: 'channel', type: 'channel', description: 'Where to post it (defaults to here)' },
      { name: 'title', type: 'string', description: 'Custom title for the panel' },
    ],
    async run(ctx, a) {
      assert(tickets.cfgOf(ctx.guild).category, 'Run `ticketsetup` first.');
      const ch = a.channel || ctx.channel;
      assert(ch.isTextBased(), 'Pick a text channel.');
      await ch.send(tickets.panel(ctx.guild, a.title));
      return ok(`Panel posted in ${ch}.`);
    },
  },
  {
    name: 'tickettopic',
    description: 'Add or remove a topic in the ticket menu (e.g. "Billing")',
    ...admin,
    options: [{ name: 'topic', type: 'string', required: true, description: 'Topic name. Use the same name again to remove it' }],
    run(ctx, a) {
      const topics = tickets.cfgOf(ctx.guild).topics;
      const i = topics.findIndex((t) => t.toLowerCase() === a.topic.toLowerCase());
      if (i >= 0) topics.splice(i, 1);
      else {
        assert(topics.length < 25, 'Discord menus max out at 25 topics.');
        topics.push(a.topic.slice(0, 100));
      }
      db.save();
      return ok(`${i >= 0 ? 'Removed' : 'Added'} **${a.topic}**. Topics: ${topics.join(', ') || 'none (plain button)'}.\nRepost the panel with \`ticketpanel\` to update it.`);
    },
  },
  {
    name: 'ticketstaff',
    description: 'Add or remove a staff role that can see tickets',
    ...admin,
    options: [{ name: 'role', type: 'role', required: true, description: 'Role' }],
    run(ctx, a) {
      const list = tickets.cfgOf(ctx.guild).staffRoles;
      const had = list.includes(a.role.id);
      if (had) list.splice(list.indexOf(a.role.id), 1);
      else list.push(a.role.id);
      db.save();
      return ok(had ? `${a.role} won't see new tickets.` : `${a.role} will see new tickets.`);
    },
  },
  {
    name: 'ticket',
    description: 'Open a support ticket',
    guildOnly: true,
    cooldown: 10,
    options: [{ name: 'topic', type: 'string', description: 'What it is about' }],
    async run(ctx, a) {
      assert(tickets.cfgOf(ctx.guild).category, "Tickets aren't set up here yet.");
      const ch = await tickets.open(ctx.guild, ctx.member, a.topic);
      return ok(`Your ticket is open: ${ch}`);
    },
    async onComponent(i, [action, extra]) {
      if (action === 'open') {
        const cfg = tickets.cfgOf(i.guild);
        const topic = i.isStringSelectMenu() ? cfg.topics[Number(i.values[0])] : null;
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          const ch = await tickets.open(i.guild, i.member, topic);
          return i.editReply(card({ description: `🎫 Your ticket is open: ${ch}`, color: C.success }));
        } catch (e) {
          if (e instanceof UserError) return i.editReply(card({ description: e.message, color: C.warn }));
          throw e;
        }
      }
      const t = tickets.cfgOf(i.guild).open[i.channelId];
      if (!t) return i.reply(eph(card({ description: 'This ticket is already closed.', color: C.warn })));
      if (action === 'claim') {
        if (!tickets.isStaff(i.member)) return i.reply(eph(card({ description: 'Only staff can claim tickets.', color: C.warn })));
        t.claimedBy = i.user.id;
        db.save();
        await i.message.edit(tickets.welcome(i.guild, t)).catch(() => {});
        return i.reply(card({ description: `🙋 <@${i.user.id}> is handling this one.`, color: C.info }));
      }
      if (action === 'close') {
        if (i.user.id !== t.owner && !tickets.isStaff(i.member))
          return i.reply(eph(card({ description: "You can't close someone else's ticket.", color: C.warn })));
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket:confirmclose').setLabel('Yes, close it').setStyle(ButtonStyle.Danger),
        );
        return i.reply(eph(card({ description: 'Close this ticket? A transcript gets saved first.', rows: [row] })));
      }
      if (action === 'confirmclose') {
        await i.update(card({ description: 'Saving the transcript…' }));
        return tickets.close(i.channel, i.user);
      }
    },
  },
  {
    name: 'ticketclose',
    description: 'Close the ticket you are in and save a transcript',
    guildOnly: true,
    options: [{ name: 'reason', type: 'string', description: 'Why it is being closed' }],
    async run(ctx, a) {
      const t = current(ctx);
      assert(ctx.user.id === t.owner || tickets.isStaff(ctx.member), "You can't close someone else's ticket.");
      await ctx.reply(card({ description: 'Saving the transcript…' }));
      await tickets.close(ctx.channel, ctx.user, a.reason);
    },
  },
  {
    name: 'ticketadd',
    description: 'Let someone else into this ticket',
    guildOnly: true,
    options: [{ name: 'user', type: 'user', required: true, description: 'Who to add' }],
    async run(ctx, a) {
      current(ctx);
      staffOnly(ctx);
      await ctx.channel.permissionOverwrites.edit(a.user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      return ok(`Added <@${a.user.id}> to the ticket.`);
    },
  },
  {
    name: 'ticketremove',
    description: 'Take someone out of this ticket',
    guildOnly: true,
    options: [{ name: 'user', type: 'user', required: true, description: 'Who to remove' }],
    async run(ctx, a) {
      const t = current(ctx);
      staffOnly(ctx);
      assert(a.user.id !== t.owner, "You can't remove the person who opened it. Close the ticket instead.");
      await ctx.channel.permissionOverwrites.delete(a.user.id);
      return ok(`Removed <@${a.user.id}>.`);
    },
  },
  {
    name: 'ticketrename',
    description: 'Rename this ticket channel',
    guildOnly: true,
    options: [{ name: 'name', type: 'string', required: true, description: 'New name' }],
    async run(ctx, a) {
      current(ctx);
      staffOnly(ctx);
      await ctx.channel.setName(a.name.slice(0, 90));
      return ok(`Renamed to **${ctx.channel.name}**.`);
    },
  },
  {
    name: 'ticketclaim',
    description: 'Claim this ticket so others know you are on it',
    guildOnly: true,
    run(ctx) {
      const t = current(ctx);
      staffOnly(ctx);
      t.claimedBy = ctx.user.id;
      db.save();
      return ok(`<@${ctx.user.id}> is handling this one.`);
    },
  },
  {
    name: 'tickets',
    description: 'List open tickets',
    guildOnly: true,
    perms: [P.ManageMessages],
    run(ctx) {
      const open = Object.entries(tickets.cfgOf(ctx.guild).open).filter(([id]) => ctx.guild.channels.cache.has(id));
      return card({
        title: `🎫 ${open.length} open ticket${open.length === 1 ? '' : 's'}`,
        description:
          open
            .map(([id, t]) => `<#${id}> by <@${t.owner}>, ${ts(t.opened, 'R')}${t.claimedBy ? ` · <@${t.claimedBy}>` : ' · unclaimed'}`)
            .join('\n') || 'All quiet.',
      });
    },
  },
];
