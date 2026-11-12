# All-in-One CV2 Bot

A Discord bot that tries to do a bit of everything: moderation, economy, levels, giveaways, games, and a lot of small tools. It's built on discord.js v14, and every reply uses Discord's newer **Components V2** layout instead of classic embeds.

There are 693 commands in total. All of them work with a prefix (`!` by default). Slash commands cover the most used ones plus every bigger feature (automod, tickets, backups and so on) as subcommands, while staying at exactly 100, which is Discord's limit. The full list, with aliases and permissions, is in **[COMMANDS.md](COMMANDS.md)**.

## Getting it running

You'll need Node.js 22.12 or newer (`@discordjs/voice` requires it, and 22.5+ gives you the SQLite storage). Older Node falls back to a single JSON file and can't do music.

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications) and add a bot to it.
2. Under **Bot**, turn on the **Server Members** and **Message Content** intents. Prefix commands won't work without the second one.
3. Invite the bot with the `bot` and `applications.commands` scopes. Giving it Administrator is the easy option. If you'd rather not, it needs Manage Roles, Manage Channels, Manage Messages, Manage Webhooks, Manage Server, View Audit Log, Kick, Ban, Moderate Members, Move Members, Add Reactions and Read Message History. Anti-nuke needs **View Audit Log**, and the bot's role has to sit above the roles it should manage.

Then:

```bash
npm install
cp .env.example .env    # add your token and application ID
npm test                # offline checks: commands, AI staff, server features
npm run deploy          # registers the slash commands
npm start
```

Global slash commands can take a while to show up. While you're testing, set `DEV_GUILD_ID` in `.env` so they register to your server instantly.

## What it can do

| Category | Count | Includes |
|---|---:|---|
| moderation | 49 | bans, kicks, timeouts, warnings, filtered purges, lockdowns, role and voice tools, mod notes |
| config | 24 | per-server prefix, logs, welcome/leave messages, autorole, level roles, toggling commands |
| economy | 38 | wallet and bank, daily streaks, jobs, robbing, a shop, blackjack, slots, fishing and mining |
| leveling | 12 | XP from chatting, rank, leaderboard, level-up roles, rep, profiles |
| utility | 55 | user/server/role info, snipe, AFK, reminders, polls, tags, todos |
| fun | 53 | 8ball, ship, truth or dare, would you rather, jokes, roasts, cowsay |
| actions | 40 | anime reaction GIFs: hug, pat, slap and friends |
| images | 27 | cats, dogs, foxes, memes, xkcd, NASA's picture of the day, Pokédex, QR codes |
| web | 10 | weather, translate, trivia, dictionary, Wikipedia, GitHub, npm, crypto, countries, Minecraft status |
| random | 27 | random pickers, passwords, team splitting, giveaways |
| math | 75 | a safe calculator, stats, primes, base conversion, loan/tip/BMI calculators |
| convert | 69 | units, live currency rates, time zones, date maths |
| text | 79 | fancy fonts, ciphers, encoders, case converters, morse |
| dev | 18 | hashes, JWT decoding, JSON formatting, regex testing, DNS lookups |
| color | 11 | color info, palettes, contrast checks |
| meta | 4 | the interactive help menu and command search |
| automod | 14 | spam, duplicate, mention, link, invite, caps, emoji, line-break and bad word filters, strikes, escalating punishments, exempt roles and channels, syncing to Discord's AutoMod |
| security | 7 | anti-raid (join bursts, minimum account age, raid mode), anti-nuke, button or captcha verification |
| logging | 4 | per-type log channels or a one-command logs category |
| tickets | 11 | ticket panels with topics, claim/close buttons, transcripts |
| selfroles | 8 | button role panels and reaction roles |
| community | 15 | starboard, suggestions with voting, counting, birthdays |
| customcommands | 5 | server-made commands with `{user}`, `{server}`, `{args}` placeholders |
| tempvc | 7 | join-to-create voice rooms the owner can rename, lock, cap and kick from |
| automation | 7 | scheduled and repeating messages, YouTube / Twitch / Reddit / RSS alerts |
| backup | 5 | back up roles, channels and permissions; restore what's missing; export as JSON |
| music | 8 | YouTube playback (optional, see below) |
| download | 1 | `download` a YouTube/Instagram video straight into the channel (nothing stored) |
| ai | 8 | AI memory, server docs and FAQ answers, AI moderation |
| features | 2 | switch any feature or whole command category on or off per server |

Type `!help` (or `/help`) in Discord to browse all of it.

### Setting up the server features

Most features do nothing until you set them up, so turning the bot on in a busy server is safe. The usual first steps:

```
/logs setup                         one category with a channel per log type
/automod setup                      sensible filter defaults, then /automod status
/security antiraid enabled:true     plus /security antinuke enabled:true
/security verifysetup               button or captcha gate for new members
/ticket setup  ->  /ticket panel    support tickets
/features list                      see what's on and off
```

Automod and Discord's own AutoMod work together: `/automod native` copies your bad words and mention limit into Discord's AutoMod, which also works while the bot is offline. The bot-side filters cover the rest (spam, duplicates, caps, emoji walls...).

### Music (optional)

Music is the least reliable part of the bot. YouTube breaks third-party players every few months, and voice needs extra native pieces.

The voice packages (`@discordjs/voice`, `@snazzah/davey`, `opusscript`, `libsodium-wrappers`) are already listed in `package.json`, so a normal `npm install` pulls them in. What you still need on the machine:

```bash
ffmpeg --version    # must be on PATH
```

`opusscript` is the pure-JS Opus encoder, which is plenty for a handful of listeners; if you're on a small VPS and CPU matters, swap it for `@discordjs/opus`.

**yt-dlp takes care of itself.** `src/lib/ytdlp.js` looks for `yt-dlp` on `PATH` (or `YTDLP_PATH`), and if there isn't one it downloads the official build into `data/bin/` the first time a music or download command runs. In Termux it pulls the Python zipapp instead, so `python3` has to exist there. Shared Android storage
can't run files we write, so in that case the binary lands in `~/.cache/allinone/bin` instead; set
`YTDLP_DIR` to choose the folder, or `YTDLP_PATH` to point at a yt-dlp you installed yourself. Delete
the cached file to force a fresh copy when YouTube breaks an old build.

If ffmpeg (or the voice packages) turn out to be missing, the music commands say so instead of failing
silently. One more gotcha: voice needs native modules, and those won't load from Android shared storage
(the usual `/sdcard/Download`). If the bot lives there, move the project into Termux's home directory
and run `npm install` again.

### Downloading videos

`s!download <link>` grabs a YouTube, Instagram, TikTok, Twitter/X, Reddit, Vimeo or
Facebook post and posts the file straight into the channel. It works the same way as music — yt-dlp
fetches it, ffmpeg merges the audio and video when it has to — but nothing is kept: the file goes to
a temp folder, gets uploaded, and the folder is wiped either way. Quality drops automatically for
long videos (720p, then 480p, then 360p) so the result fits Discord's 25 MB upload limit; anything
still too big is refused with the reason.

### Social alerts

`/feed add` follows YouTube channels, Reddit and any RSS feed without API keys. Twitch live alerts use [decapi.me](https://decapi.me), a free public service, so they depend on it being up. Feeds are checked every 5 minutes.

## AI staff

Mention the bot and just ask, like you would a human mod:

> @Slash hey, can you make some basic roles?
> @Slash lock #general and put a 10s slowmode on #memes
> @Slash who got timed out today, and what's 15% of 240?

It runs on [Groq](https://console.groq.com) (free tier works). Put your key in `GROQ_API_KEY` and you're done. If a model name in `.env` stops working, run `curl -s https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"` to see what your key can use; `GROQ_MODEL`, `GROQ_ROUTER_MODEL`, `GROQ_VISION_MODEL` and `GROQ_GUARD_MODEL` are all overridable.

Groq is behind Cloudflare, which rejects the default Node.js user agent with `error code: 1010`. `src/ai/groq.js` sends a browser-like `User-Agent` header to avoid that; keep it if you rewrite the client.

**What it can do:** 797 things. That's 104 direct server actions (roles, channels, members, messages, threads, server settings, emojis, invites, webhooks, AutoMod, and its own memory and docs) plus every one of the bot's 693 commands, which it can run for you.

**It knows your server:**
- `/ai remember` teaches it facts ("our mod role is called Guardians"). It can also save facts itself when an admin asks it to.
- `/ai docadd` uploads rules, FAQs or guides (paste text or attach a .txt / .md). The relevant parts get pulled into each request, and `/ai ask` answers questions only from those docs.
- Attach a screenshot when you mention it and it reads the image (a vision model on Groq: Qwen3.8-27B by default, set `GROQ_VISION_MODEL` to change it).

**AI moderation (opt-in):** `/ai moderation enabled:true` runs messages through a safety model on Groq (GPT-OSS Safeguard by default, `GROQ_GUARD_MODEL` to change it). It either flags them in the mod log or deletes them too. Mods are skipped, it's capped at 20 checks per minute per server so it can't burn your Groq quota, and noisy categories like "specialized advice" are ignored. It can be wrong, so treat it as a helper.

**How it stays safe:**
- It acts with *your* permissions, not its own. If you can't ban people, neither can it on your behalf, and it won't create a role with permissions you don't have.
- Anything that changes the server is shown as a plan first. Nothing happens until you press **Do it**. Risky steps (deleting, banning, purging) are marked with ⚠️, and only the person who asked can confirm.
- Big plans (more than 8 steps, up to 60) are confirmed in batches of 8. You can approve the next batch, approve all of the rest at once, or stop partway.
- It respects role hierarchy, never touches the server owner, and checks permissions again at the moment it runs each step.
- Owner-only commands are never offered to the AI.

**How it works:** a quick first call picks the 1 to 4 relevant groups out of 40, so Groq only sees the tools it needs (68 at most, never all 796). Then the model calls tools. Read-only ones run straight away. Changes get queued for your confirmation. Code lives in `src/ai/`; to add a server action, drop an object into one of the files in `src/ai/actions/`.

The design borrows from open-source agents like [discord-bot-agents](https://github.com/fazelllyyy/discord-bot-agents) (plan, execute, summarise, with fuzzy name matching and hierarchy checks).

When `GROQ_API_KEY` isn't set, mentions work like the prefix, so `@Slash ping` still runs `ping`.

## Making it yours

- **The bot's personality:** `prompt/default.md` is sent in front of every AI request. It's plain markdown with `{{bot}}`, `{{server}}`, `{{user}}`, `{{handle}}` and `{{permissions}}` placeholders, and edits apply on the next mention. See `prompt/README.md`.
- **The command list:** `COMMANDS.md` is generated from `src/commands/` by `npm run docs`. Run it after adding or renaming commands so the docs don't drift.
- **Choosing slash commands:** the list lives in `src/slash.js`. Discord allows 100 global commands, and `npm test` will tell you if a name doesn't exist or the count is off.
- **Adding a command:** drop an object into any file in `src/commands/`:

  ```js
  {
    name: 'hello',
    description: 'Say hi',
    options: [{ name: 'who', type: 'user', description: 'Who to greet' }],
    run: (ctx, { who }) => `Hey ${who ?? ctx.user}!`,
  }
  ```

  The same definition handles both `!hello` and `/hello`. Arguments are parsed for you.
- **Data:** everything is stored in `data/bot.sqlite` using Node's built-in SQLite, so there's nothing to compile or host. If you're upgrading from an older version, your `data/db.json` gets imported the first time it starts and is kept as `db.json.bak`. Copy the `data` folder now and then as a backup.
- **Turning things off:** `/features set` switches off any feature or whole command category for a server (say, no economy in a serious server). Moderation, config and meta can't be switched off, so nobody locks themselves out.
- **APOD:** NASA's demo key is rate-limited. Put your own key in `NASA_KEY` if people use `apod` a lot.

## What's not in here

- **Image generation.** Groq doesn't offer image models, and adding another paid provider felt like too much for a default install.
- **Web dashboard and sharding.** Both are big projects on their own. Everything is configured with commands, and a single process is fine until roughly 2,500 servers.

## License

MIT. Do what you like with it.
