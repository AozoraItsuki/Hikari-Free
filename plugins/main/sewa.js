import config from '#config';
let hikari = async (m, { conn }) => {
  try {
    let teks = `
╭───⌈  *HIKARI FULL VERSION*  ⌋───
│
│ ✨ You are using *Hikari-Free* (10 commands).
│ The full version has *350+ plugins*:
│
│ • ⚔️ 58 RPG & economy systems
│ • 🤖 AI personas + auto AI
│ • ⬇️ Downloaders (YouTube, TikTok, IG...)
│ • 🎮 60+ games & fun commands
│ • 🤖 Subbots, SQLite database & more
│
│ 💬 *Get the full version here:*
│ ──────────────
│ • https://wa.me/6285129987364
│ • 085129987364
│
╰──────────────────────
`.trim();
    await conn.adReply(
      m.chat,
      teks,
      'F U L L - V E R S I O N',
      '',
      config.media.image.thumbnail,
      config.website,
      m
    );
  } catch (e) {}
};
hikari.help = ['sewabot'];
hikari.command = /^sewa(bot)?$/i;
export default hikari;
