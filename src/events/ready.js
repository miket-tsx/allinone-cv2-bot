// Background scheduler for reminders and giveaways. State lives in the db so it survives restarts.
const { Events } = require('discord.js');
const db = require('../lib/db');
const { card, C } = require('../lib/ui');
const giveaways = require('../lib/giveaways');

module.exports = {
  event: Events.ClientReady,
  once: true,
  async run(client) {
    client.user.setActivity(`${process.env.DEFAULT_PREFIX || '!'}help · /help`);
    setInterval(async () => {
      const now = Date.now();
      const due = db.data.reminders.filter((r) => r.at <= now);
      if (due.length) {
        // Save before sending so a slow send can't double-fire on the next tick.
        db.data.reminders = db.data.reminders.filter((r) => r.at > now);
        db.save();
        for (const r of due) {
          // Mentions inside Components V2 text displays still ping when allowed.
          const payload = {
            ...card({
              title: '⏰ Psst, your reminder is here',
              description: `<@${r.userId}> ${r.text}`,
              color: C.info,
              footer: 'You asked for this on ' + new Date(r.created).toUTCString(),
            }),
            allowedMentions: { users: [r.userId] },
          };
          const ch = await client.channels.fetch(r.channelId).catch(() => null);
          const sent = ch?.isTextBased() ? await ch.send(payload).catch(() => null) : null;
          // Channel gone or locked down? Slide into their DMs instead.
          if (!sent) (await client.users.fetch(r.userId).catch(() => null))?.send(payload).catch(() => {});
        }
      }
      for (const g of db.data.giveaways.filter((x) => !x.ended && x.endsAt <= now))
        await giveaways.end(client, g).catch((e) => console.error('[giveaway]', e));
    }, 10000);
  },
};
