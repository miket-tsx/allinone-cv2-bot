# Prompt folder

`default.md` is the bot's personality and standing instructions. `src/ai/agent.js` puts it in
front of every AI request, filling in the placeholders first. Edit it and the next mention
picks the change up — no restart needed. Delete it and the bot falls back to a built-in copy.

Placeholders you can use anywhere in `default.md`:

| Placeholder | Becomes |
|---|---|
| `{{bot}}` | the bot's username |
| `{{server}}` | the server's name |
| `{{user}}` | the display name of whoever is talking |
| `{{handle}}` | their `@username` |
| `{{permissions}}` | their permissions, or `Administrator` |

Keep it about *how* the bot should behave. The command list, server memory and saved docs are
added to the prompt automatically, so there's no need to paste them here.
