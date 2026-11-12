# All commands

Every one of the bot's **693** commands works with the prefix (`s!` by default, or whatever a server sets).
The **200** with a slash name also work as `/commands`; the rest are prefix-only to stay inside Discord's 100-command limit.

Arguments shown in the options column are what the command expects, in order. Aliases are the short forms that do the same thing.

> Generated from `src/commands/` by `npm run docs` — do not edit by hand.

## Contents

- [actions](#actions) (40)
- [ai](#ai) (8)
- [automation](#automation) (7)
- [automod](#automod) (14)
- [backup](#backup) (5)
- [color](#color) (11)
- [community](#community) (15)
- [config](#config) (24)
- [convert](#convert) (69)
- [customcommands](#customcommands) (5)
- [dev](#dev) (18)
- [download](#download) (1)
- [economy](#economy) (38)
- [features](#features) (2)
- [fun](#fun) (53)
- [images](#images) (27)
- [leveling](#leveling) (12)
- [logging](#logging) (4)
- [math](#math) (75)
- [meta](#meta) (4)
- [moderation](#moderation) (49)
- [music](#music) (8)
- [random](#random) (27)
- [security](#security) (7)
- [selfroles](#selfroles) (8)
- [tempvc](#tempvc) (7)
- [text](#text) (79)
- [tickets](#tickets) (11)
- [utility](#utility) (55)
- [web](#web) (10)

## actions

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `baka` | — | user? | — | — | Anime GIF energy: calls baka someone |
| `bite` | — | user? | — | — | Anime GIF energy: bites someone |
| `blush` | — | user? | — | — | Anime GIF mood: blushes |
| `bored` | — | user? | — | — | Anime GIF mood: is bored |
| `cry` | — | user? | — | — | Anime GIF mood: cries |
| `cuddle` | — | user? | — | — | Anime GIF energy: cuddles someone |
| `dance` | — | user? | — | — | Anime GIF mood: dances |
| `facepalm` | — | user? | — | — | Anime GIF mood: facepalms |
| `feed` | — | user? | — | — | Anime GIF energy: feeds someone |
| `handhold` | — | user? | — | — | Anime GIF energy: holds hands with someone |
| `handshake` | — | user? | — | — | Anime GIF energy: shakes hands with someone |
| `happy` | — | user? | — | — | Anime GIF mood: is happy |
| `highfive` | — | user? | — | — | Anime GIF energy: high-fives someone |
| `hug` | — | user? | /hug | — | Anime GIF energy: hugs someone |
| `kiss` | — | user? | — | — | Anime GIF energy: kisses someone |
| `laugh` | — | user? | — | — | Anime GIF mood: laughs |
| `lurk` | — | user? | — | — | Anime GIF mood: lurks |
| `nod` | — | user? | — | — | Anime GIF mood: nods |
| `nom` | — | user? | — | — | Anime GIF energy: noms someone |
| `nope` | — | user? | — | — | Anime GIF mood: says nope |
| `pat` | — | user? | /pat | — | Anime GIF energy: pats someone |
| `peck` | — | user? | — | — | Anime GIF energy: gives a peck to someone |
| `poke` | — | user? | — | — | Anime GIF energy: pokes someone |
| `pout` | — | user? | — | — | Anime GIF mood: pouts |
| `punch` | — | user? | — | — | Anime GIF energy: punches someone |
| `run` | — | user? | — | — | Anime GIF mood: runs away |
| `shoot` | — | user? | — | — | Anime GIF energy: finger-guns someone |
| `shrug` | — | user? | — | — | Anime GIF mood: shrugs |
| `slap` | — | user? | — | — | Anime GIF energy: slaps someone |
| `sleep` | — | user? | — | — | Anime GIF mood: falls asleep |
| `smile` | — | user? | — | — | Anime GIF mood: smiles |
| `smug` | — | user? | — | — | Anime GIF mood: looks smug |
| `stare` | — | user? | — | — | Anime GIF energy: stares at someone |
| `think` | — | user? | — | — | Anime GIF mood: is thinking |
| `thumbsup` | — | user? | — | — | Anime GIF mood: gives a thumbs up |
| `tickle` | — | user? | — | — | Anime GIF energy: tickles someone |
| `wave` | — | user? | — | — | Anime GIF energy: waves at someone |
| `wink` | — | user? | — | — | Anime GIF mood: winks |
| `yawn` | — | user? | — | — | Anime GIF mood: yawns |
| `yeet` | — | user? | — | — | Anime GIF energy: yeets someone |

## ai

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `aidocadd` | — | title, text? | /ai docadd | Manage Guild | Add or replace a server doc (rules, FAQ, guides) the AI answers from |
| `aidocremove` | — | doc | /ai docremove | Manage Guild | Remove a server doc |
| `aidocs` | — | — | /ai docs | — | List the server docs the AI answers from |
| `aiforget` | — | memory | /ai forget | Manage Guild | Make the AI staff forget something |
| `aimemories` | — | — | /ai memories | Manage Guild | See what the AI staff remembers about this server |
| `aimod` | — | enabled?, action?, channel? | /ai moderation | Manage Guild | Set up AI moderation (AI safety model). Off by default |
| `airemember` | — | fact | /ai remember | Manage Guild | Teach the AI staff a fact about this server |
| `askdocs` | `faq` | question | /ai ask | — | Ask a question and get an answer from this server's docs and FAQ |

## automation

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `feedadd` | — | type, source, channel, message? | /feed add | Manage Guild | Post alerts for new YouTube videos, Twitch streams, Reddit posts or RSS items |
| `feedremove` | — | id | /feed remove | Manage Guild | Stop following a feed |
| `feeds` | — | — | /feed list | Manage Guild | List the social feeds this server follows |
| `feedtest` | — | id | /feed test | Manage Guild | Post the latest item from a feed right now, to check it works |
| `schedule` | — | channel, in, repeat, message | /schedule add | Manage Guild | Post a message later, once or on repeat |
| `scheduleremove` | — | id | /schedule remove | Manage Guild | Cancel a scheduled message |
| `schedules` | — | — | /schedule list | Manage Guild | List scheduled messages in this server |

## automod

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `automod` | `am` | — | /automod status | Manage Guild | See how automod is set up in this server |
| `automodallow` | — | domain | /automod allowlink | Manage Guild | Allow links to a website when the links filter is on |
| `automoddecay` | — | hours | /automod decay | Manage Guild | How long strikes stick around before they expire |
| `automodfilter` | — | filter, enabled, value?, seconds? | /automod filter | Manage Guild | Switch one automod filter on or off, and optionally tune its limit |
| `automodignore` | — | role?, channel? | /automod ignore | Manage Guild | Make automod ignore a role or channel (run again to undo) |
| `automodnative` | — | — | /automod native | Manage Guild | Copy the blocklist and spam limits into Discord's built-in AutoMod |
| `automodpunish` | — | strikes, action, duration? | /automod punish | Manage Guild | Set what happens at a number of strikes (action "none" removes the step) |
| `automodsetup` | — | — | /automod setup | Manage Guild | Turn on automod with sensible defaults in one go |
| `automodtoggle` | — | enabled | /automod toggle | Manage Guild | Turn automod on or off |
| `badword` | `blockword` | words | /automod badword | Manage Guild | Add words to the blocklist (comma separated) |
| `badwordremove` | `unblockword` | words | /automod unbadword | Manage Guild | Take words off the blocklist (comma separated) |
| `badwords` | — | — | /automod badwords | Manage Guild | See the blocklist (sent privately) |
| `clearstrikes` | — | user | /automod clearstrikes | Moderate Members | Wipe someone's automod strikes |
| `strikes` | — | user | /automod strikes | Moderate Members | Check someone's automod strikes |

## backup

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `backup` | — | — | /backup create | Administrator | Save a backup of the roles, channels and permissions |
| `backupdelete` | — | id | /backup delete | Administrator | Delete a saved backup |
| `backupexport` | — | id? | /backup export | Administrator | Download a backup as a JSON file |
| `backuprestore` | — | id | /backup restore | Administrator | Recreate roles and channels from a backup that are missing now |
| `backups` | — | — | /backup list | Administrator | List the saved backups |

## color

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `color` | `colour`, `colorinfo` | color | /tools color | — | Get the full rundown and a swatch for any color |
| `complement` | — | color | — | — | Find the color sitting opposite on the wheel |
| `contrast` | — | first, second | — | — | Check the WCAG contrast ratio of two colors |
| `darken` | — | color | — | — | Make a color moodier by darkening it 15% |
| `grayscale` | `greyscale` | color | — | — | Drain all the fun (and color) out of a color |
| `invertcolor` | `invert` | color | — | — | Flip a color to its exact opposite |
| `lighten` | — | color | — | — | Brighten a color by 15% |
| `mixcolors` | `blend` | first, second | — | — | Blend two colors half and half |
| `palette` | — | color? | — | — | Whip up a 5-color palette that actually goes together |
| `randomcolor` | `randomcolour` | — | — | — | Roll the dice and get a random color |
| `rolecolor` | — | role | — | — | Peek at a role's color |

## community

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `birthday` | `bday` | date | /birthday set | — | Save your birthday (month and day) so the server can celebrate |
| `birthdayremove` | — | — | /birthday remove | — | Forget your birthday |
| `birthdays` | — | — | /birthday list | — | Upcoming birthdays in this server |
| `birthdaysetup` | — | channel, role?, message? | /birthday setup | Manage Guild | Where to announce birthdays, plus an optional birthday role for the day |
| `counting` | — | — | /counting stats | — | See the counting stats |
| `countingchannel` | — | channel, math? | /counting setup | Manage Guild | Make a channel the counting channel (1, 2, 3, ...) |
| `countingoff` | — | — | /counting off | Manage Guild | Turn counting off |
| `countingset` | — | number | /counting set | Manage Guild | Set the current count by hand |
| `starboard` | — | channel?, threshold?, emoji?, self_star? | /starboard setup | Manage Guild | Set up the starboard: popular messages get reposted to a highlights channel |
| `starboardoff` | — | — | /starboard off | Manage Guild | Turn the starboard off |
| `suggest` | — | idea | /suggest new | — | Suggest something for the server |
| `suggestchannel` | — | channel | /suggest channel | Manage Guild | Pick the channel where suggestions get posted |
| `suggestionapprove` | — | number, note? | /suggest approve | Manage Messages | Mark a suggestion as approved |
| `suggestionconsider` | — | number, note? | /suggest consider | Manage Messages | Mark a suggestion as under consideration |
| `suggestiondeny` | — | number, note? | /suggest deny | Manage Messages | Mark a suggestion as denied |

## config

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `autorole` | — | role | /autorole | Manage Guild | Automatically hand a role to everyone who joins |
| `disableautorole` | — | — | — | Manage Guild | Stop auto-assigning a role on join |
| `disablecommand` | — | command | /disablecommand | Manage Guild | Switch off a command in this server |
| `disabledcommands` | — | — | — | — | See which commands are switched off here |
| `disableleave` | — | — | — | Manage Guild | Stop posting goodbye messages |
| `disablelogs` | — | — | — | Manage Guild | Stop logging |
| `disablewelcome` | — | — | — | Manage Guild | Stop greeting new members |
| `enablecommand` | — | command | — | Manage Guild | Turn a disabled command back on |
| `leavemessage` | `leavemsg` | message | — | Manage Guild | Set the goodbye text. Variables: {user} {username} {server} {count} |
| `levelchannel` | — | channel? | — | Manage Guild | Where to announce level-ups (leave empty to use the current chat) |
| `levelrole` | — | level, role | /levelrole | Manage Guild | Hand out a role as a reward at a certain level |
| `levelroles` | — | — | — | — | See all the level role rewards |
| `prefix` | — | — | — | — | Check which prefix I answer to here |
| `removelevelrole` | — | level | — | Manage Guild | Remove a level role reward |
| `resetprefix` | — | — | — | Manage Guild | Put the prefix back to the default |
| `resetsettings` | — | — | — | Administrator | Wipe all bot settings for this server (economy and levels stay put) |
| `setleave` | `setgoodbye` | channel | /setleave | Manage Guild | Pick the channel for goodbye messages |
| `setlogs` | `setlog`, `modlog` | channel | /setlogs | Manage Guild | Pick the channel for moderation and message logs |
| `setprefix` | — | prefix | /setprefix | Manage Guild | Change what you type to summon me in this server |
| `settings` | `config` | — | /settings | — | Show how I’m set up in this server |
| `setwelcome` | — | channel | /setwelcome | Manage Guild | Pick the channel where new members get greeted |
| `testwelcome` | — | — | — | Manage Guild | Preview the welcome message using yourself as the guinea pig |
| `togglelevels` | — | — | — | Manage Guild | Turn the leveling system on or off |
| `welcomemessage` | `welcomemsg` | message | — | Manage Guild | Set the welcome text. Variables: {user} {username} {server} {count} |

## convert

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `acre2m2` | — | value | — | — | Acres → square metres |
| `adddays` | — | date, days | — | — | Shift a date forward or back by a number of days |
| `age` | — | birthdate | — | — | Work out exact age from a birthday (YYYY-MM-DD) |
| `atm2kpa` | — | value | — | — | Atmospheres → kilopascals |
| `bar2psi` | — | value | — | — | Bar → PSI |
| `c2f` | — | value | — | — | Celsius → Fahrenheit |
| `c2k` | — | value | — | — | Celsius → Kelvin |
| `cm2in` | — | value | — | — | Centimetres → inches |
| `convert` | `conv`, `unit` | value, from, to | /tools convert | — | Convert between units, e.g. convert 10 km mi (length, mass, temp, data…) |
| `cup2ml` | — | value | — | — | US cups → millilitres |
| `currency` | `fx`, `exchange` | amount, from, to | /tools currency | — | Convert money using live rates, e.g. currency 100 USD EUR |
| `datediff` | — | start, end | — | — | How far apart two dates are |
| `day2h` | — | value | — | — | Days → hours |
| `dayssince` | — | date | — | — | Count the days since a date |
| `daysuntil` | `countdown` | date | — | — | Count the days until a date |
| `f2c` | — | value | — | — | Fahrenheit → Celsius |
| `f2k` | — | value | — | — | Fahrenheit → Kelvin |
| `floz2ml` | — | value | — | — | US fl oz → millilitres |
| `fromunix` | — | seconds | — | — | Turn a Unix timestamp into a human-readable date |
| `ft22m2` | — | value | — | — | Square feet → square metres |
| `ft2m` | — | value | — | — | Feet → metres |
| `g2oz` | — | value | — | — | Grams → ounces |
| `gal2l` | — | value | — | — | US gallons → litres |
| `gb2mb` | — | value | — | — | Gigabytes → megabytes |
| `gib2gb` | — | value | — | — | Gibibytes → gigabytes |
| `h2min` | — | value | — | — | Hours → minutes |
| `ha2acre` | — | value | — | — | Hectares → acres |
| `hp2kw` | — | value | — | — | Horsepower → kilowatts |
| `in2cm` | — | value | — | — | Inches → centimetres |
| `k2c` | — | value | — | — | Kelvin → Celsius |
| `k2f` | — | value | — | — | Kelvin → Fahrenheit |
| `kcal2kj` | — | value | — | — | Kilocalories → kilojoules |
| `kg2lb` | — | value | — | — | Kilograms → pounds |
| `kg2st` | — | value | — | — | Kilograms → stone |
| `kj2kcal` | — | value | — | — | Kilojoules → kilocalories |
| `km2mi` | — | value | — | — | Kilometres → miles |
| `kmh2mph` | — | value | — | — | km/h → mph |
| `knot2kmh` | — | value | — | — | Knots → km/h |
| `kw2hp` | — | value | — | — | Kilowatts → horsepower |
| `kwh2j` | — | value | — | — | Kilowatt-hours → joules |
| `l2gal` | — | value | — | — | Litres → US gallons |
| `lb2kg` | — | value | — | — | Pounds → kilograms |
| `leapyear` | — | year | — | — | Is it a leap year? Find out |
| `m22ft2` | — | value | — | — | Square metres → square feet |
| `m2ft` | — | value | — | — | Metres → feet |
| `m2yd` | — | value | — | — | Metres → yards |
| `mb2bit` | — | value | — | — | Megabytes → bits |
| `mb2gb` | — | value | — | — | Megabytes → gigabytes |
| `mi2km` | — | value | — | — | Miles → kilometres |
| `min2s` | — | value | — | — | Minutes → seconds |
| `ml2cup` | — | value | — | — | Millilitres → US cups |
| `ml2floz` | — | value | — | — | Millilitres → US fl oz |
| `mm2in` | — | value | — | — | Millimetres → inches |
| `mph2kmh` | — | value | — | — | mph → km/h |
| `ms2kmh` | — | value | — | — | m/s → km/h |
| `nmi2km` | — | value | — | — | Nautical miles → kilometres |
| `oz2g` | — | value | — | — | Ounces → grams |
| `psi2bar` | — | value | — | — | PSI → bar |
| `st2kg` | — | value | — | — | Stone → kilograms |
| `tb2gb` | — | value | — | — | Terabytes → gigabytes |
| `tbsp2ml` | — | value | — | — | Tablespoons → millilitres |
| `time` | `clock`, `timein` | zone? | /tools time | — | What time is it in a timezone or city? e.g. time Asia/Tokyo, time london |
| `timeconvert` | `tzconvert` | time, from, to | — | — | Convert a time between zones, e.g. timeconvert 18:30 ist pst |
| `tsp2ml` | — | value | — | — | Teaspoons → millilitres |
| `units` | — | — | — | — | Everything the converter knows how to convert |
| `unixtime` | `epoch`, `now` | — | — | — | The current Unix timestamp, fresh off the clock |
| `weekday` | — | date | — | — | Find out which day of the week a date lands on |
| `yd2m` | — | value | — | — | Yards → metres |
| `year2day` | — | value | — | — | Years → days |

## customcommands

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `ccadd` | `addcc` | name, response | /cc add | Manage Guild | Make a custom command for this server |
| `ccedit` | — | name, response | /cc edit | Manage Guild | Change what a custom command says |
| `ccinfo` | — | name | — | — | Details about one custom command |
| `cclist` | `customcommands`, `ccs` | — | /cc list | — | List this server's custom commands |
| `ccremove` | `ccdelete`, `delcc` | name | /cc remove | Manage Guild | Delete a custom command |

## dev

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `bytes` | — | text | — | — | How big is your text? Bytes (UTF-8) and characters |
| `cron` | — | expression | — | — | Translate a 5-field cron expression into plain English-ish |
| `dns` | `dnslookup` | domain, type? | — | — | Look up DNS records for a domain |
| `hmac` | — | key, text | — | — | Sign some text with a key using HMAC-SHA256 |
| `httpstatus` | `http` | code | — | — | What does that HTTP status code actually mean? |
| `json` | `prettyjson` | json | — | — | Check that your JSON is valid and make it pretty |
| `jwtdecode` | `jwt` | token | — | — | Peek inside a JWT (header + payload, signature is NOT verified) |
| `lorem` | `loremipsum` | words? | — | — | Whip up some lorem ipsum filler text |
| `md5` | — | text | — | — | Get the MD5 hash of any text |
| `minifyjson` | — | json | — | — | Squish JSON down to a single line |
| `regex` | `regextest` | pattern, text | — | — | Try a regex against some text: /pattern/flags text |
| `sha1` | — | text | — | — | Get the SHA1 hash of any text |
| `sha256` | — | text | — | — | Get the SHA256 hash of any text |
| `sha384` | — | text | — | — | Get the SHA384 hash of any text |
| `sha512` | — | text | — | — | Get the SHA512 hash of any text |
| `snowflake` | — | id | — | — | Find out when a Discord ID was created (and a bit more) |
| `timestampms` | — | date | — | — | Turn a date string into Unix time and ISO format |
| `urlparse` | — | url | — | — | Take a URL apart and see what it is made of |

## download

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `download` | `dl`, `ytdl` | url | — | — | Grab a YouTube or Instagram video and post it here (nothing is saved) |

## economy

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `addmoney` | — | user, amount | — | Manage Guild | Admin: conjure coins out of thin air for a member |
| `balance` | `bal`, `money`, `wallet` | user? | /balance | — | Peek at your wallet and bank (or snoop on someone else’s) |
| `beg` | — | — | — | — | Hold out a cup and beg strangers for coins |
| `betflip` | `cfbet` | side, amount | — | — | Call it in the air: heads or tails |
| `betroll` | — | amount | — | — | Roll 1-100: 66+ doubles, 90+ triples, 100 ×10 |
| `blackjack` | `bj` | amount | /blackjack | — | Take on the dealer in a hand of blackjack |
| `buy` | — | item, amount? | /buy | — | Spend some coins on a shop item |
| `chop` | — | — | — | — | Chop down a few trees (needs an axe) |
| `cooldowns` | `cd` | — | — | — | See what you’re still waiting on |
| `crime` | — | — | — | — | Commit a totally fictional crime. Risky, obviously |
| `daily` | — | — | /daily | — | 📅 Daily paycheck |
| `deposit` | `dep` | amount | /deposit | — | Stash coins in the bank where robbers can’t reach them |
| `dig` | — | — | — | — | Dig for buried treasure (needs a shovel) |
| `fish` | — | — | — | — | Cast a line and see what bites (needs a fishing rod) |
| `gamble` | `bet` | amount | — | — | Roll against the bot — higher number wins |
| `giveitem` | — | user, item, amount? | — | — | Hand an item over to another member |
| `highlow` | `hl` | amount | — | — | Guess if the next number (1-100) is higher or lower |
| `hunt` | — | — | — | — | Stalk something tasty (needs a bow) |
| `inventory` | `inv`, `items` | user? | /inventory | — | Rummage through your items (or someone else’s) |
| `iteminfo` | — | item | — | — | Get the full scoop on a shop item |
| `mine` | — | — | — | — | Swing a pickaxe at some rocks (needs a pickaxe) |
| `monthly` | — | — | — | — | 📆 Monthly windfall |
| `networth` | `nw` | user? | — | — | Wallet + bank + what your items would sell for |
| `pay` | `give`, `transfer` | user, amount | /pay | — | Share the wealth with another member |
| `postmeme` | — | — | — | — | Post a meme and hope it lands (needs a laptop) |
| `removemoney` | — | user, amount | — | Manage Guild | Admin: make a member’s coins disappear |
| `reseteconomy` | `reseteco` | user | — | Manage Guild | Admin: wipe a member’s economy data clean |
| `richest` | `baltop`, `ecolb` | — | /richest | — | See who’s hoarding the most coins in this server |
| `rob` | — | user | /rob | — | Try to lift some coins from someone’s wallet |
| `roulette` | — | choice, amount | — | — | Bet on red, black, green, or a number 0-36 |
| `scratch` | `scratchcard` | — | — | — | Buy a scratch card for 250 coins |
| `search` | — | — | — | — | Dig through random places for loose change |
| `sell` | — | item, amount? | — | — | Sell an item back for 70% of its price |
| `shop` | `store` | — | /shop | — | Browse the item shop (window shopping is free) |
| `slots` | `slot` | amount | /slots | — | Pull the lever on the slot machine |
| `weekly` | — | — | /weekly | — | 🗓️ Weekly bonus |
| `withdraw` | `with` | amount | /withdraw | — | Pull coins out of the bank and into your wallet |
| `work` | — | — | /work | — | Clock in for a shift and earn some coins |

## features

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `feature` | `module` | name, enabled | /features set | Manage Guild | Switch a feature or a whole command category on or off |
| `features` | `modules` | — | /features list | Manage Guild | See which features and command categories are on in this server |

## fun

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `8ball` | `eightball` | question | /8ball | — | Shake the magic 8-ball and brace yourself for the truth |
| `advice` | — | — | — | — | Unsolicited advice, fresh from the internet |
| `bubblewrap` | — | — | — | — | Pop some virtual bubble wrap. Weirdly satisfying |
| `catfact` | — | — | — | — | A random fact about our feline overlords |
| `catsay` | — | text | — | — | Make a cat say whatever you want (it may ignore you) |
| `chadrate` | — | user? | — | — | Measure the chad energy |
| `choose` | `pick` | options | /fun choose | — | Can't decide? Give me options split by \| or commas and I'll pick one |
| `chucknorris` | `chuck` | — | — | — | A Chuck Norris fact, because he made us |
| `coinflip` | `cf`, `flip` | — | /coinflip | — | Flip a coin and let fate decide |
| `compliment` | — | user? | /fun compliment | — | Hand out a compliment, free of charge |
| `cookie` | — | user | — | — | Hand someone a cookie, because you care |
| `cookies` | — | user? | — | — | Peek at how big someone's cookie stash is |
| `cowsay` | — | text | — | — | Make a cow say whatever you want |
| `dadjoke` | — | — | — | — | A dad joke. Groaning is encouraged |
| `dare` | — | — | /fun dare | — | A dare you can totally back out of (but won't) |
| `dogfact` | — | — | — | — | A random fact about very good dogs |
| `emojisoup` | — | — | — | — | Serve up a steaming bowl of emoji soup |
| `f` | — | thing? | — | — | Press F to pay respects |
| `fact` | `randomfact` | — | — | — | A random fact you'll never need but can't unlearn |
| `fight` | — | user | /fun fight | — | Settle it in a fully simulated brawl with someone |
| `fortune` | — | — | — | — | Crack open a fortune cookie |
| `hack` | — | user | — | — | Hack someone. Extremely real, definitely legal |
| `horoscope` | — | sign | — | — | Your daily horoscope, made up with total confidence |
| `howcool` | — | user? | — | — | Measure how cool someone is |
| `hungry` | — | user? | — | — | Find out how hungry someone is |
| `insult` | — | user? | — | — | A silly, harmless insult (nobody gets hurt) |
| `iq` | — | user? | — | — | Take a 100% scientifically rigorous IQ test |
| `joke` | — | — | /fun joke | — | A random joke, quality not guaranteed |
| `kanye` | — | — | — | — | Words of wisdom from Kanye West |
| `luck` | — | user? | — | — | Find out how lucky someone is today |
| `magicconch` | — | question | — | — | Consult the magic conch shell. It has opinions |
| `motivate` | `motivation` | — | — | — | A tiny pep talk, no coffee required |
| `nerdrate` | — | user? | — | — | Find out how nerdy someone is |
| `neverhaveiever` | `nhie` | — | — | — | Never have I ever… time to confess |
| `pickupline` | — | — | — | — | A pickup line so cheesy it comes with crackers |
| `programmingjoke` | `devjoke` | — | — | — | A programming joke that only some of you will get |
| `quote` | `inspire` | — | — | — | A quote to make you feel briefly profound |
| `rate` | — | thing | — | — | Get my completely unbiased rating of anything, out of 10 |
| `reverseuno` | — | — | — | — | Slam down an Uno reverse card |
| `riddle` | — | — | — | — | A riddle to chew on. The answer hides in a spoiler |
| `roast` | — | user? | /fun roast | — | A light roast, served warm. All in good fun |
| `roll` | `dice` | dice? | /roll | — | Roll some dice in NdM format, like 2d6 (defaults to 1d6) |
| `russianroulette` | `rr` | — | — | — | Spin the cylinder and pray… 1 in 6 odds |
| `ship` | `love`, `lovecalc` | user1, user2? | /fun ship | — | Check how well two people would get on (romantically, allegedly) |
| `showerthought` | — | — | — | — | A shower thought to keep you up tonight |
| `simprate` | — | user? | — | — | Measure someone's simp levels |
| `smartrate` | — | user? | — | — | A brain power check |
| `sus` | — | user? | — | — | Check how suspicious someone is |
| `tonguetwister` | — | — | — | — | A tongue twister to tie your mouth in knots |
| `topic` | — | — | — | — | A conversation starter for when chat goes quiet |
| `truth` | — | — | /fun truth | — | A truth question. No lying, we can tell |
| `vibecheck` | — | user? | — | — | Run a vibe check. Results are final |
| `wouldyourather` | `wyr` | — | /fun wouldyourather | — | A "would you rather" to start an argument |

## images

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `apod` | — | — | — | — | NASA's Astronomy Picture of the Day |
| `beagle` | — | — | — | — | A random Beagle, fresh from the park |
| `cat` | `kitty` | — | /cat | — | A random cat, no questions asked |
| `catgif` | — | — | — | — | A random cat GIF, for emergencies |
| `catsays` | — | text | — | — | A cat that says whatever you want it to |
| `coffee` | — | — | — | — | A random coffee, since we all need one |
| `corgi` | — | — | — | — | A random Corgi, fresh from the park |
| `dog` | `doggo`, `puppy` | — | /dog | — | A random good dog |
| `dogbreed` | — | breed | — | — | A picture of the dog breed of your choice |
| `duck` | — | — | — | — | A random duck, mostly quacking |
| `fox` | — | — | — | — | A random fox, extra floofy |
| `goldenretriever` | — | — | — | — | A random Golden Retriever, fresh from the park |
| `husbando` | — | — | — | — | A fresh husbando pic, safe for work |
| `husky` | — | — | — | — | A random Husky, fresh from the park |
| `kitsune` | — | — | — | — | A fresh kitsune pic, safe for work |
| `meme` | `memes` | — | /meme | — | A random meme, fresh off Reddit |
| `neko` | — | — | — | — | A fresh neko pic, safe for work |
| `placeholder` | — | size | — | — | A placeholder image in any size, e.g. placeholder 600x400 |
| `pokemon` | `pokedex` | name | /pokemon | — | Look up a Pokémon in the Pokédex |
| `pug` | — | — | — | — | A random Pug, fresh from the park |
| `qrcode` | `qr` | text | /tools qrcode | — | Turn text or a link into a QR code |
| `reddit` | — | subreddit | — | — | A random image post from any subreddit (SFW only) |
| `robohash` | `robot` | text? | — | — | A one-of-a-kind robot avatar for any text |
| `samoyed` | — | — | — | — | A random Samoyed, fresh from the park |
| `shiba` | — | — | — | — | A random Shiba Inu, fresh from the park |
| `waifu` | — | — | — | — | A fresh waifu pic, safe for work |
| `xkcd` | — | number? | /xkcd | — | An xkcd comic: the latest, a random one, or pick a number |

## leveling

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `addxp` | — | user, amount | — | Manage Guild | Admin: slip a member some bonus XP |
| `levels` | `leaderboard`, `lb`, `top` | — | /levels | — | The server’s top XP grinders |
| `messages` | `msgs` | user? | — | — | Count how many messages someone has sent since I showed up |
| `profile` | — | user? | /profile | — | The full rundown: level, coins, rep and bio |
| `rank` | `level`, `xp` | user? | /rank | — | Check your level, XP and where you sit on the leaderboard |
| `removexp` | — | user, amount | — | Manage Guild | Admin: take some XP away from a member |
| `rep` | — | user | /rep | — | Give someone a reputation point (one per 24h, spend it wisely) |
| `reptop` | — | — | — | — | The most well-liked people in the server |
| `resetlevels` | — | — | — | Administrator | Admin: wipe XP for the entire server (no undo!) |
| `resetxp` | — | user | — | Manage Guild | Admin: wipe a member’s XP back to zero |
| `setbio` | — | bio | — | — | Write something about yourself for your profile |
| `setlevel` | — | user, level | — | Manage Guild | Admin: force a member to a specific level |

## logging

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `logchannel` | — | type, channel? | /logs channel | Manage Guild | Send one kind of log to its own channel ("reset" to use the main one) |
| `logignore` | — | channel | /logs ignore | Manage Guild | Stop (or start again) logging a noisy channel's messages |
| `logs` | — | — | /logs overview | Manage Guild | See where each kind of log goes |
| `logsetup` | — | — | /logs setup | Manage Guild | Create a private logs category with a channel for each kind of log |

## math

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `abs` | — | x | — | — | Absolute value (drops the minus sign) |
| `add` | `plus` | a, b | — | — | Add two numbers together |
| `average` | `mean`, `avg` | numbers | — | — | The average (mean) of your numbers |
| `average3` | `gradeneeded` | current, target, weight | — | — | What you need on the final to hit your target grade |
| `bin2dec` | — | value | — | — | Binary → decimal |
| `bin2hex` | — | value | — | — | Binary → hexadecimal |
| `bmi` | — | weight, height | — | — | Body Mass Index from weight (kg) and height (cm) |
| `calc` | `math`, `calculate`, `=` | expression | /tools calc | — | Your pocket calculator: 2^10, sqrt(2)*pi, 5!, sin(pi/2)… |
| `cbrt` | — | x | — | — | Cube root |
| `ceil` | — | x | — | — | Round up |
| `circle` | — | radius | — | — | Area, circumference and diameter from a radius |
| `collatz` | — | n | — | — | Follow the Collatz sequence from n down to 1 |
| `convertbase` | `base` | from, to, value | — | — | Convert a number between any two bases from 2 to 36 |
| `cos` | — | x | — | — | Cosine (in degrees) |
| `cube` | — | x | — | — | Cube a number |
| `dec2bin` | — | value | — | — | Decimal → binary |
| `dec2hex` | — | value | — | — | Decimal → hexadecimal |
| `dec2oct` | — | value | — | — | Decimal → octal |
| `deg2rad` | — | x | — | — | Degrees → radians |
| `digitsum` | — | n | — | — | Add up all the digits of a number |
| `discount` | — | price, percent | — | — | See what something costs after the discount |
| `divide` | — | a, b | — | — | Divide one number by another |
| `divisors` | — | n | — | — | Every number that divides evenly into n |
| `exp` | — | x | — | — | e raised to the power of x |
| `factorial` | — | n | — | — | n! for any n from 0 to 170 |
| `fibonacci` | `fib` | n | — | — | The n-th Fibonacci number, plus how we got there |
| `floor` | — | x | — | — | Round down |
| `gcd` | `hcf` | a, b | — | — | Greatest common divisor |
| `hex2bin` | — | value | — | — | Hexadecimal → binary |
| `hex2dec` | — | value | — | — | Hexadecimal → decimal |
| `hypotenuse` | `hypot` | a, b | — | — | Let Pythagoras find the hypotenuse from two sides |
| `interest` | `compound` | principal, rate, years, times? | — | — | Watch your money grow: principal, annual rate %, years |
| `isprime` | `prime` | n | — | — | Find out if a number is prime |
| `lcm` | — | a, b | — | — | Least common multiple |
| `ln` | — | x | — | — | Natural logarithm |
| `loan` | `emi`, `mortgage` | amount, rate, years | — | — | Monthly payment on a loan: amount, annual rate %, years |
| `log10` | `log` | x | — | — | Base-10 logarithm |
| `logbase` | — | a, b | — | — | Logarithm of a in base b |
| `maximum` | `max` | numbers | — | — | The largest of the bunch |
| `median` | — | numbers | — | — | The middle value of your numbers |
| `minimum` | `min` | numbers | — | — | The smallest of the bunch |
| `mode` | — | numbers | — | — | Whichever number(s) show up most often |
| `modulo` | `mod` | a, b | — | — | The remainder of a ÷ b |
| `multiply` | `times` | a, b | — | — | Multiply two numbers |
| `ncr` | `combinations` | a, b | — | — | Combinations: how many ways to choose b from a |
| `npr` | `permutations` | a, b | — | — | Permutations: how many ways to arrange b of a |
| `numbertowords` | `numwords` | n | — | — | Spell a number out in English |
| `oct2dec` | — | value | — | — | Octal → decimal |
| `percentage` | — | a, b | — | — | What percent is a of b? |
| `percentchange` | — | a, b | — | — | Percent change from a to b |
| `percentof` | — | a, b | — | — | What is a% of b? |
| `power` | `pow` | a, b | — | — | Raise a to the power of b |
| `primefactors` | `factorize` | n | — | — | Break a number down into its prime factors |
| `primes` | — | n | — | — | List every prime up to n |
| `product` | — | numbers | — | — | Multiply a bunch of numbers together |
| `quadratic` | — | a, b, c | — | — | Solve ax² + bx + c = 0, complex roots included |
| `rad2deg` | — | x | — | — | Radians → degrees |
| `range` | — | numbers | — | — | The spread between the biggest and smallest (max − min) |
| `reciprocal` | — | x | — | — | Flip it: 1 ÷ x |
| `roman` | — | n | — | — | Turn a number into Roman numerals |
| `root` | `nthroot` | a, b | — | — | The b-th root of a |
| `round` | — | x | — | — | Round to the nearest whole number |
| `sin` | — | x | — | — | Sine (in degrees) |
| `sortnumbers` | `sortnum` | numbers | — | — | Sort numbers from smallest to largest |
| `sphere` | — | radius | — | — | Volume and surface area of a sphere |
| `sqrt` | — | x | — | — | Square root |
| `square` | — | x | — | — | Square a number |
| `stddev` | `standarddeviation` | numbers | — | — | Population standard deviation |
| `subtract` | `minus` | a, b | — | — | Take one number away from another |
| `sum` | `total` | numbers | — | — | Add up a bunch of numbers |
| `tan` | — | x | — | — | Tangent (in degrees) |
| `tip` | — | bill, percent, people? | — | — | Work out the tip and split the bill |
| `triangle` | — | a, b, c | — | — | Area and perimeter of a triangle from its three sides |
| `unroman` | `fromroman` | numeral | — | — | Turn Roman numerals back into a number |
| `variance` | — | numbers | — | — | Population variance |

## meta

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `categories` | — | — | — | — | See which categories exist and how many commands each has |
| `help` | `h`, `commands`, `cmds` | command? | /help | — | Browse commands by category, or dig into one in detail |
| `searchcommands` | `findcmd` | query | — | — | Can't remember a command? Search by keyword |
| `slashlist` | `slashcommands` | — | — | — | Every slash command I know, all in one place |

## moderation

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `addrole` | `giverole` | user, role | /addrole | Manage Roles | Give a role to a member |
| `ban` | `hackban` | user, days?, reason? | /ban | Ban Members | Ban a member (or a user ID) from the server |
| `baninfo` | — | userid | — | Ban Members | Look up why a user was banned |
| `banlist` | — | — | — | Ban Members | Show who’s banned from the server |
| `clearmodnotes` | — | user | — | Moderate Members | Shred all moderator notes for a member |
| `clearwarns` | — | user | /clearwarns | Moderate Members | Wipe every warning for a member |
| `createrole` | — | color, name | — | Manage Roles | Create a brand new role |
| `deafen` | — | user | — | Mute Members | Server-deafen a member in voice |
| `dehoist` | — | — | — | Manage Nicknames | Strip leading symbols people use to hoist their names to the top |
| `deleterole` | — | role | — | Manage Roles | Delete a role for good |
| `delwarn` | — | user, number | — | Moderate Members | Delete a single warning by its number |
| `hide` | — | channel? | — | Manage Channels | Hide a channel from @everyone |
| `kick` | — | user, reason? | /kick | Kick Members | Kick a member from the server |
| `lock` | — | channel? | /lock | Manage Channels | Stop @everyone from sending messages in a channel |
| `lockdown` | — | — | /lockdown | Administrator | Lock every text channel in the server |
| `massrole` | — | role | — | Administrator | Give a role to every human member (slow on big servers) |
| `modnote` | — | user, note | /modnote | Moderate Members | Jot down a private moderator note about a member |
| `modnotes` | — | user | — | Moderate Members | Read the moderator notes on a member |
| `nick` | `setnick` | user, nickname | /nick | Manage Nicknames | Change a member’s nickname |
| `nuke` | — | — | /nuke | Administrator | Clone this channel and delete the original (wipes all messages) |
| `purge` | — | amount | /purge | Manage Messages | Bulk delete recent messages |
| `purgeattachments` | — | amount | — | Manage Messages | Delete recent messages with attachments |
| `purgebots` | — | amount | — | Manage Messages | Delete recent messages sent by bots |
| `purgecontains` | — | amount, text | — | Manage Messages | Delete recent messages containing some text |
| `purgeembeds` | — | amount | — | Manage Messages | Delete recent messages with embeds |
| `purgehumans` | — | amount | — | Manage Messages | Delete recent messages sent by actual humans |
| `purgelinks` | — | amount | — | Manage Messages | Delete recent messages containing links |
| `purgementions` | — | amount | — | Manage Messages | Delete recent messages that ping users or roles |
| `purgeuser` | — | amount, user | — | Manage Messages | Delete recent messages from one specific user |
| `removerole` | `takerole` | user, role | /removerole | Manage Roles | Take a role away from a member |
| `renamechannel` | — | name | — | Manage Channels | Rename the current channel |
| `resetnick` | — | user | — | Manage Nicknames | Reset a member’s nickname |
| `roleclear` | — | role | — | Administrator | Remove a role from everyone who has it |
| `settopic` | — | topic | — | Manage Channels | Set the current channel’s topic |
| `slowmode` | — | duration | /slowmode | Manage Channels | Set channel slowmode (0 to turn it off), e.g. 5s, 1m |
| `softban` | — | user, reason? | — | Ban Members | Ban then instantly unban to wipe a member’s recent messages |
| `timeout` | `mute` | user, duration, reason? | /timeout | Moderate Members | Put a member in timeout (e.g. 10m, 2h, 1d — max 28d) |
| `unban` | — | userid, reason? | /unban | Ban Members | Give someone a second chance: unban a user by ID |
| `undeafen` | — | user | — | Mute Members | Server-undeafen a member in voice |
| `unhide` | — | channel? | — | Manage Channels | Make a hidden channel visible to @everyone again |
| `unlock` | — | channel? | /unlock | Manage Channels | Let @everyone send messages in a channel again |
| `unlockdown` | — | — | — | Administrator | Unlock every text channel in the server |
| `untimeout` | `unmute` | user, reason? | /untimeout | Moderate Members | Let a member out of timeout early |
| `vckick` | — | user | — | Mute Members | Disconnect a member from voice |
| `vcmove` | — | user, channel | — | Move Members | Move a member to another voice channel |
| `vcmute` | — | user | — | Mute Members | Server-mute a member in voice |
| `vcunmute` | — | user | — | Mute Members | Server-unmute a member in voice |
| `warn` | — | user, reason | /warn | Moderate Members | Warn a member (it goes on their record) |
| `warnings` | `warns` | user | /warnings | Moderate Members | See a member’s warnings |

## music

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `loop` | — | — | /music loop | — | Loop the current song on or off |
| `nowplaying` | `np` | — | /music nowplaying | — | What's playing right now |
| `pause` | — | — | /music pause | — | Pause the music |
| `play` | `p` | song | /music play | — | Play a song from YouTube (search or link) |
| `queue` | `q` | — | /music queue | — | See what's coming up |
| `resume` | — | — | /music resume | — | Resume the music |
| `skip` | — | — | /music skip | — | Skip the current song |
| `stop` | `leave`, `disconnect` | — | /music stop | — | Stop the music and leave the voice channel |

## random

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `coinflips` | — | times | — | — | Flip a coin a whole bunch of times |
| `gend` | — | id | /gend | Manage Guild | End a giveaway right now |
| `glist` | — | — | — | — | See which giveaways are running right now |
| `greroll` | — | id | /greroll | Manage Guild | Reroll the winner(s) of a giveaway that has ended |
| `gstart` | `giveaway` | duration, winners, prize | /gstart | Manage Guild | Start a giveaway, e.g. gstart 1h 1 Nitro |
| `lotto` | — | — | — | — | Generate your lucky lottery numbers (6 of 49) |
| `password` | `pass`, `genpass` | length? | /password | — | Generate a strong random password (only you see it with slash) |
| `pickfrom` | — | count, items | — | — | Pick N random items from a list |
| `random` | `rng`, `randomnumber` | min, max | /random | — | Roll a random number between min and max |
| `randomanimal` | — | — | — | — | Meet a random animal |
| `randomcard` | `drawcard` | — | — | — | Draw a random card from the deck |
| `randomcolorname` | — | — | — | — | Get a random color name |
| `randomcountry` | — | — | — | — | Get a random country for your next daydream |
| `randomdate` | — | — | — | — | Get a random date somewhere between 1900 and 2100 |
| `randomemoji` | — | count? | — | — | Spit out some random emojis |
| `randomfood` | `whattoeat` | — | — | — | Can't decide what to eat? Let fate choose |
| `randomhex` | — | bytes? | — | — | Generate a random hex string |
| `randomip` | — | — | — | — | Make up a random IPv4 address (probably not real) |
| `randomletter` | — | — | — | — | Get a random letter from A to Z |
| `randommember` | `randomuser` | role? | — | — | Pick a random member, optionally limited to one role |
| `randomname` | — | — | — | — | Dream up a random full name |
| `randomword` | — | — | — | — | Get a random word, no context included |
| `shuffle` | — | items | — | — | Shuffle a list (a, b, c or a \| b \| c) |
| `tarot` | — | — | — | — | Draw a tarot card (results not legally binding) |
| `teams` | — | count, names | /teams | — | Split a list of names into N random teams |
| `uuid` | `guid` | count? | — | — | Generate a random UUID v4 |
| `yesno` | — | — | — | — | Let fate answer your yes/no question |

## security

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `antinuke` | — | enabled?, punishment?, seconds? | /security antinuke | Administrator | See or change anti-nuke protection against rogue admins and bots |
| `antinukelimit` | — | action, limit | /security nukelimit | Administrator | Change one anti-nuke limit |
| `antinukewhitelist` | — | user | /security trust | Administrator | Trust or untrust someone so anti-nuke leaves them alone |
| `antiraid` | — | enabled?, joins?, seconds?, action?, min_account_days? | /security antiraid | Manage Guild | See or change anti-raid protection |
| `raidmode` | — | enabled | /security raidmode | Manage Guild | Start or end raid mode by hand |
| `verify` | — | channel? | /security verifypanel | Manage Guild | Post the verification button again |
| `verifysetup` | — | role, channel, mode?, remove_role? | /security verifysetup | Manage Guild | Set up verification: new members press a button to get a role |

## selfroles

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `reactionrole` | — | message, emoji, role | /selfroles reaction | Manage Roles | React to a message with an emoji to get a role (old-school style) |
| `reactionroleremove` | — | message, emoji | /selfroles unreaction | Manage Roles | Remove a reaction role from a message |
| `rolepanel` | — | channel, title | /selfroles panel | Manage Roles | Post a self-role panel with buttons (add roles with rolepaneladd) |
| `rolepaneladd` | — | panel, role, emoji?, label? | /selfroles add | Manage Roles | Add a role button to a panel |
| `rolepaneldelete` | — | panel | /selfroles delete | Manage Roles | Delete a role panel |
| `rolepanelremove` | — | panel, role | /selfroles remove | Manage Roles | Take a role button off a panel |
| `rolepanels` | — | — | /selfroles list | Manage Roles | List the role panels and reaction roles in this server |
| `rolepanelsingle` | — | panel, single | /selfroles single | Manage Roles | Make a panel "pick one" (like colour roles) or "pick any" |

## tempvc

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `roomkick` | — | user | /tempvc kick | — | Kick someone out of your temporary voice room |
| `roomlimit` | — | limit | /tempvc limit | — | Cap how many people can join your room (0 = no limit) |
| `roomlock` | — | — | /tempvc lock | — | Lock your room so nobody new can join |
| `roomrename` | — | name | /tempvc rename | — | Rename your temporary voice channel |
| `roomunlock` | — | — | /tempvc unlock | — | Unlock your room |
| `tempvcoff` | — | — | /tempvc off | Manage Guild | Turn off temporary voice channels |
| `tempvcsetup` | — | category?, name? | /tempvc setup | Manage Guild | Create a "Join to create" voice channel |

## text

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `acronym` | — | text | — | — | Boil a phrase down to an acronym |
| `anagram` | — | first, second | — | — | Check if two words or phrases are anagrams |
| `atbash` | — | text | — | — | Atbash cipher, flips A↔Z |
| `base64` | `b64` | text | /tools base64 | — | Text → Base64 |
| `binary` | — | text | — | — | Text → binary, for the 0s and 1s enthusiasts |
| `bold` | — | text | — | — | 𝐁𝐨𝐥𝐝 unicode text, no markdown needed |
| `bolditalic` | — | text | — | — | 𝙱𝚘𝚕𝚍 𝚒𝚝𝚊𝚕𝚒𝚌 unicode text, double the drama |
| `braille` | — | text | — | — | Text → Braille |
| `bubble` | `circled` | text | — | — | Ⓑⓤⓑⓑⓛⓔ letters, round and cheerful |
| `caesar` | — | shift, text | — | — | Caesar cipher with a shift of your choosing |
| `camelcase` | — | text | — | — | camelCaseText, humps included |
| `charcodes` | `ascii` | text | — | — | Characters → decimal char codes |
| `clap` | — | text | — | — | Add 👏 a clap 👏 between 👏 words |
| `codeblock` | — | language, code | — | — | Wrap code in a code block with syntax highlighting |
| `constantcase` | `screamingcase` | text | — | — | CONSTANT_CASE_TEXT, for values that never change |
| `count` | `wordcount`, `charcount` | text | — | — | Count characters, words, lines and other trivia |
| `disapprove` | — | — | — | — | ಠ_ಠ |
| `doublestruck` | `outline` | text | — | — | 𝔻𝕠𝕦𝕓𝕝𝕖-struck text, blackboard style |
| `emojify` | `bigtext` | text | — | — | Turn text into big 🇪 🇲 🇴 🇯 🇮 letters |
| `fliptable` | — | — | — | — | (╯°□°)╯︵ ┻━┻ |
| `fraktur` | `gothic` | text | — | — | 𝕱𝖗𝖆𝖐𝖙𝖚𝖗 unicode text, extremely medieval |
| `hex` | `tohex` | text | — | — | Text → hexadecimal |
| `htmlescape` | — | text | — | — | Escape HTML entities so they behave |
| `italic` | — | text | — | — | 𝘐𝘵𝘢𝘭𝘪𝘤 unicode text, no markdown needed |
| `kebabcase` | — | text | — | — | kebab-case-text, served on a skewer |
| `leet` | `1337` | text | — | — | 1337 5p34k for 5up3r h4x0rz |
| `lenny` | — | — | — | — | ( ͡° ͜ʖ ͡°) |
| `lower` | `lowercase` | text | — | — | whisper your text in lowercase |
| `mirror` | — | text | — | — | Reverse the letters in each word but keep the word order |
| `mock` | `spongebob` | text | — | — | sPoNgEbOb MoCk text, for when someone deserves it |
| `monospace` | — | text | — | — | 𝚖𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎 unicode text, typewriter vibes |
| `morse` | — | text | /tools morse | — | Text → Morse code (dots and dashes ahoy) |
| `nato` | — | text | — | — | Spell it all out with the NATO alphabet |
| `octal` | — | text | — | — | Text → octal |
| `owo` | `uwu` | text | — | — | OwO-ify text (we're sorry) |
| `palindrome` | — | text | — | — | Check whether text reads the same both ways |
| `pascalcase` | — | text | — | — | PascalCaseText, like camel but bolder |
| `piglatin` | — | text | — | — | Translate to Pig Latin (anslatetray otay igpay atinlay) |
| `pirate` | — | text | — | — | Translate to pirate speak, arrr |
| `randomcase` | — | text | — | — | rAnDOm cASe, decided by pure chaos |
| `removespaces` | — | text | — | — | Removeallthespaces, justlikethis |
| `repeat` | — | times, text | — | — | Repeat text a bunch of times |
| `reverse` | — | text | — | — | Flip your text backwards |
| `reversewords` | — | text | — | — | Reverse the order of the words |
| `rot13` | — | text | — | — | ROT13 encode/decode (same trick both ways) |
| `rot47` | — | text | — | — | ROT47 encode/decode (ROT13 with more symbols) |
| `script` | `cursive` | text | — | — | 𝓢𝓬𝓻𝓲𝓹𝓽 unicode text, wedding invitation energy |
| `sentencecase` | — | text | — | — | Sentence case, like a well-behaved paragraph |
| `shrugface` | — | — | — | — | ¯\_(ツ)_/¯ |
| `shufflewords` | — | text | — | — | Shuffle the words into a fresh mess |
| `slugify` | `slug` | text | — | — | make-a-url-friendly-slug |
| `smallcaps` | — | text | — | — | sᴍᴀʟʟ ᴄᴀᴘs for a quieter kind of loud |
| `snakecase` | — | text | — | — | snake_case_text, sssmooth |
| `sortwords` | — | text | — | — | Sort words alphabetically |
| `spaced` | `space` | text | — | — | S p a c e  o u t your text |
| `spoilerall` | `spoilerify` | text | — | — | Wrap every single character in its own spoiler |
| `squared` | — | text | — | — | 🅂🅀🅄🄰🅁🄴🄳 letters, all boxed in |
| `stretch` | — | text | — | — | Streeetch your voweeels |
| `strike` | `strikethrough` | text | — | — | S̶t̶r̶i̶k̶e̶t̶h̶r̶o̶u̶g̶h̶ text, no markdown required |
| `stutter` | — | text | — | — | S-s-stutter your t-text |
| `subscript` | — | text | — | — | ₛᵤᵦₛ꜀ᵣᵢₚₜ text (only some letters make it) |
| `superscript` | `tiny` | text | — | — | ˢᵘᵖᵉʳˢᶜʳⁱᵖᵗ text for tiny floating words |
| `swapcase` | — | text | — | — | sWAP tHE cASE, because why not |
| `titlecase` | — | text | — | — | Title Case Text, Like A Fancy Headline |
| `unbase64` | `fromb64`, `debase64` | text | — | — | Base64 → text |
| `unbinary` | `frombinary` | text | — | — | Binary → text |
| `underline` | — | text | — | — | U̲n̲d̲e̲r̲l̲i̲n̲e̲ text, no markdown required |
| `unflip` | — | — | — | — | ┬─┬ ノ( ゜-゜ノ) |
| `unhex` | `fromhex` | text | — | — | Hexadecimal → text |
| `uniquewords` | — | text | — | — | Drop duplicate words, keeping the first of each |
| `unmorse` | `frommorse` | text | — | — | Morse code → text |
| `upper` | `uppercase` | text | — | — | SHOUT YOUR TEXT |
| `upsidedown` | `fliptext` | text | — | — | uʍop ǝpᴉsdn text, turn it on its head |
| `urldecode` | — | text | — | — | URL-decode text |
| `urlencode` | — | text | — | — | URL-encode text |
| `vaporwave` | `aesthetic`, `fullwidth` | text | — | — | Ｆｕｌｌｗｉｄｔｈ ａｅｓｔｈｅｔｉｃ vibes |
| `vigenere` | — | key, text | — | — | Vigenère cipher. Start the key with - to decode instead |
| `yoda` | — | text | — | — | Talk like Yoda, you will |
| `zalgo` | `cursed` | text | — | — | Z̷̢a̸͙l̴̰g̵̜o̶̧ text, summon something cursed |

## tickets

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `ticket` | — | topic? | /ticket open | — | Open a support ticket |
| `ticketadd` | — | user | /ticket add | — | Let someone else into this ticket |
| `ticketclaim` | — | — | /ticket claim | — | Claim this ticket so others know you are on it |
| `ticketclose` | — | reason? | /ticket close | — | Close the ticket you are in and save a transcript |
| `ticketpanel` | — | channel?, title? | /ticket panel | Manage Guild | Post the "Open a ticket" panel |
| `ticketremove` | — | user | /ticket remove | — | Take someone out of this ticket |
| `ticketrename` | — | name | /ticket rename | — | Rename this ticket channel |
| `tickets` | — | — | /ticket list | Manage Messages | List open tickets |
| `ticketsetup` | — | staff, category?, logs? | /ticket setup | Manage Guild | Set up tickets: where they open, who answers them, where transcripts go |
| `ticketstaff` | — | role | /ticket staff | Manage Guild | Add or remove a staff role that can see tickets |
| `tickettopic` | — | topic | /ticket topic | Manage Guild | Add or remove a topic in the ticket menu (e.g. "Billing") |

## utility

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `admins` | `staff` | — | — | — | List the humans with Administrator |
| `afk` | — | reason? | /afk | — | Go AFK; anyone who pings you gets told you’re away |
| `announce` | — | channel, text | — | Manage Messages | Post an announcement card in a channel of your choice |
| `avatar` | `av`, `pfp` | user? | /avatar | — | Show off a user’s avatar |
| `banner` | — | user? | /banner | — | Show a user’s profile banner |
| `boosters` | — | — | — | — | Give a shout-out to this server’s boosters |
| `boosts` | — | — | — | — | How this server’s boosts are doing |
| `botinfo` | `stats`, `about` | — | /botinfo | — | Nerdy stats about me |
| `botperms` | — | — | — | — | Check which permissions I have in this channel |
| `bots` | — | — | — | — | List the bots hanging around this server |
| `cancelreminder` | `delreminder` | id | — | — | Scrap a reminder by its id |
| `card` | — | content | — | Manage Messages | Post a custom Components V2 card: card #hex \| title \| body |
| `channelinfo` | `ci` | channel? | /channelinfo | — | Details on a channel |
| `channels` | — | — | — | — | List this server’s channels, grouped by category |
| `charinfo` | — | text | — | — | Look up the Unicode code points of characters |
| `createdat` | `accountage` | user? | — | — | Find out when a Discord account was born |
| `editsnipe` | `esnipe` | — | — | — | Catch the last edited message in this channel |
| `emojiinfo` | `ei` | emoji | /emojiinfo | — | Get the details on a custom emoji |
| `emojis` | — | — | — | — | List this server’s custom emojis |
| `enlarge` | `jumbo`, `bigemoji` | emoji | — | — | Blow a custom emoji up to full size |
| `firstmessage` | — | — | — | — | Jump back to the very first message in this channel |
| `id` | — | target? | — | — | Fish the ID out of a user, role, channel or emoji mention |
| `inrole` | — | role | — | — | See who’s wearing a role |
| `invite` | — | — | /invite | — | Grab my invite link and take me to another server |
| `joinedat` | — | user? | — | — | Find out when someone joined this server |
| `membercount` | `mc` | — | /membercount | — | Humans vs. bots headcount |
| `newestmembers` | — | — | — | — | The fresh faces: most recently joined members |
| `oldestmembers` | — | — | — | — | The veterans: members with the oldest accounts |
| `permissions` | `perms` | user? | — | — | See what a member can do in this channel |
| `ping` | `latency` | — | /ping | — | Check how fast (or slow) I’m responding |
| `poll` | — | question | /poll | — | Start a button poll: poll Question \| Option 1 \| Option 2 … (up to 5) |
| `remind` | `reminder`, `remindme` | time, text | /remind | — | Set a reminder, e.g. remind 2h stretch your legs |
| `reminders` | — | — | /reminders | — | See what’s on your reminder list |
| `roleinfo` | `ri` | role | /roleinfo | — | Dig into the details of a role |
| `roles` | — | — | — | — | List this server’s roles |
| `say` | `echo` | text | /say | Manage Messages | Make me say something (I take no responsibility) |
| `serveravatar` | `sav` | user? | — | — | Show a user’s server-specific avatar |
| `serverbanner` | — | — | — | — | Show this server’s banner |
| `servericon` | — | — | — | — | Show this server’s icon |
| `serverinfo` | `si`, `guildinfo` | — | /serverinfo | — | The vital stats of this server |
| `serversplash` | — | — | — | — | Show this server’s invite splash |
| `snipe` | — | — | /snipe | — | Catch the last deleted message in this channel |
| `steal` | `addemoji` | emoji, name? | — | Manage Emojis And Stickers, Manage Guild Expressions | Swipe a custom emoji from another server and add it here |
| `tag` | `t` | name | — | — | Pull up a server tag (a saved text snippet) |
| `tagcreate` | `addtag` | name, content | — | Manage Messages | Create a new server tag |
| `tagdelete` | `deltag` | name | — | Manage Messages | Delete a server tag for good |
| `tagedit` | — | name, content | — | Manage Messages | Rewrite an existing server tag |
| `tags` | — | — | — | — | Browse this server’s tags |
| `timestamp` | `ts` | when | /timestamp | — | Turn a duration or date into Discord timestamps (e.g. 2h, 2026-12-25 18:00) |
| `todo` | — | item | /todo | — | Add something to your personal to-do list |
| `todoclear` | — | — | — | — | Wipe your to-do list clean |
| `tododone` | `todoremove` | number | — | — | Tick an item off your to-do list |
| `todos` | `todolist` | — | — | — | Peek at your to-do list |
| `uptime` | — | — | — | — | How long I’ve been awake |
| `userinfo` | `whois`, `ui`, `user` | user? | /userinfo | — | Everything Discord will tell me about a user |

## web

| Command | Aliases | Options | Slash | Needs | What it does |
|---|---|---|---|---|---|
| `country` | — | name | — | — | Quick facts about a country |
| `crypto` | `coin`, `price` | coin | — | — | Check a coin price in USD, EUR and INR |
| `define` | `dictionary`, `dict` | word | — | — | Look up an English word in the dictionary |
| `github` | `gh` | username | — | — | Peek at a GitHub user profile |
| `mcserver` | `mcstatus` | address | — | — | See if a Minecraft server is up and who is on it |
| `npm` | — | package | — | — | Look up a package on npm |
| `translate` | `tr` | to, text | /tools translate | — | Translate some text, e.g. translate es Hello there |
| `trivia` | — | difficulty? | /trivia | — | Take a shot at a multiple-choice trivia question |
| `weather` | `w`, `forecast` | place | /tools weather | — | Current weather plus a 3-day forecast for any place |
| `wiki` | `wikipedia` | query | — | — | Get the gist of a Wikipedia article |

## Owner-only commands

These only answer to the IDs in `OWNER_IDS`, and the AI staff never sees them.

None.
