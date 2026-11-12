// Components V2 helpers. Every reply the bot sends is a Container card.
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
} = require('discord.js');

const C = {
  primary: 0x5865f2,
  success: 0x57f287,
  error: 0xed4245,
  warn: 0xfee75c,
  info: 0x3498db,
  fun: 0xeb459e,
  eco: 0xf1c40f,
  mod: 0xe67e22,
  level: 0x9b59b6,
};

const trunc = (s, n) => {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
};
const text = (s) => new TextDisplayBuilder().setContent(s);
const sep = (divider = true) =>
  new SeparatorBuilder().setDivider(divider).setSpacing(SeparatorSpacingSize.Small);

/**
 * Build a Components V2 card.
 * @param {object} o title, description, color, fields [[name,value],...], thumbnail, image, images, footer, rows (ActionRowBuilders)
 */
function card(o = {}) {
  const {
    title,
    description,
    color = C.primary,
    fields = [],
    thumbnail,
    image,
    images,
    footer,
    rows = [],
    ephemeral,
  } = o;
  const c = new ContainerBuilder().setAccentColor(color);
  const head = [title ? `### ${trunc(title, 200)}` : null, description ? trunc(description, 2600) : null]
    .filter(Boolean)
    .join('\n');
  // A thumbnail can only live inside a Section, so plain text goes the other route
  if (head && thumbnail) {
    c.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(text(head))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail)),
    );
  } else if (head) c.addTextDisplayComponents(text(head));
  const fl = fields.filter((f) => f && f[1] !== undefined && f[1] !== null && f[1] !== '');
  if (fl.length) {
    if (head) c.addSeparatorComponents(sep());
    c.addTextDisplayComponents(text(trunc(fl.map(([k, v]) => `**${k}:** ${v}`).join('\n'), 1000)));
  }
  const imgs = (images || (image ? [image] : [])).filter(Boolean);
  if (imgs.length)
    c.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        ...imgs.slice(0, 10).map((u) => new MediaGalleryItemBuilder().setURL(u)),
      ),
    );
  if (footer) {
    c.addSeparatorComponents(sep(false));
    c.addTextDisplayComponents(text(`-# ${trunc(footer, 200)}`));
  }
  for (const r of rows) c.addActionRowComponents(r);
  // Discord rejects an empty container, so an invisible char keeps it valid
  if (!head && !fl.length && !imgs.length && !footer) c.addTextDisplayComponents(text('\u200b'));
  const out = { components: [c], flags: MessageFlags.IsComponentsV2 };
  if (ephemeral) out.ephemeral = true;
  return out;
}

const ok = (description, title) => card({ title, description: `✅ ${description}`, color: C.success });
// Errors are ephemeral so a typo doesn't clutter the channel
const fail = (description, title) =>
  card({ title, description: `❌ ${description}`, color: C.error, ephemeral: true });
const info = (description, title) => card({ title, description, color: C.info });

module.exports = { C, card, ok, fail, info, trunc, text, sep };
