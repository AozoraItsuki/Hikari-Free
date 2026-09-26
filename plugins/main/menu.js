import config from '#config';
import { readmore } from '#lib/utils/helper';
import { xpRange } from '#lib/utils/levelling';
import { plugins } from '#src/plugins';
import moment from 'moment-timezone';
import { db } from '#src/database';
import fs from 'fs';
import path from 'path';
const metaCache = {};
const categoryMeta = (cat) => {
  if (!(cat in metaCache)) {
    try {
      metaCache[cat] = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'plugins', cat, 'metadata.json'), 'utf-8')
      );
    } catch {
      metaCache[cat] = null;
    }
  }
  return metaCache[cat];
};
const categoryLabel = (cat) => {
  const meta = categoryMeta(cat);
  if (meta?.emoji && meta?.name) return `${meta.emoji} ${meta.name.toLowerCase()}`;
  if (cat === 'all') return '📋 all';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
};
const categoryDescription = (cat) =>
  categoryMeta(cat)?.desc ||
  (cat === 'all' ? 'Shows all available menu categories' : 'Commands in this category');
const getCategoryList = () =>
  Array.from(
    new Set(
      Object.values(plugins).flatMap((p) =>
        Array.isArray(p.category) ? p.category : p.category ? [p.category] : []
      )
    )
  );
const getTimeNow = () => {
  const date = new Date(Date.now());
  return date.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};
const menuTemplate = {
  before: `╭──❑ 「 *𝗜𝗡𝗙𝗢 𝗨𝗦𝗘𝗥* 」 ❑──
│ ✦ *Name* : %name
│ ✦ *Status* : %status
│ ✦ *Level* : %level
│ ✦ *XP* : %xp / %maxXp
│ ✦ *Date* : %date
╰❑
%readmore`,
  header: '╭──❑ 「 *%category* 」 ❑──',
  body: '│ ✦ %cmd %islimit %isPremium',
  footer:
    '╰❑\n\n🌟 *Want the Full Version?*\n💬 Chat: https://wa.me/6285129987364 (085129987364)\n350+ plugins, RPG, AI personas, subbots & more!',
  after: '𝗖𝗿𝗲𝗮𝘁𝗲𝗱 𝗕𝘆 💫 H𝗼𝘀𝗵𝗶',
};
const hikari = async (m, { conn, usedPrefix, command, isOwner, isMods, isPrems, args = [''] }) => {
  try {
    const time = getTimeNow();
    const teks = (args[0] || '').toLowerCase();
    const user = db.data.users[m.sender];
    const { level } = user;
    const { min, max, xp } = xpRange(level, 38);
    const exp = Math.max(0, user.exp - min);
    const status = isMods ? 'Developer' : isOwner ? 'Owner' : isPrems ? 'Premium' : 'Free User';
    const name = user.registered ? user.name : await conn.getName(m.sender);
    const menuHeader = `
╭──❑ 「 *𝗜𝗡𝗙𝗢 𝗕𝗢𝗧* 」 ❑──  
│ ✦ ${wish()}, *${name}*
│ ✦ *Bot Name* : ${config.bot.name}  
│ ✦ *Uptime*   : ${clockString(process.uptime() * 1000)}  
│ ✦ *Date* : ${time}
╰❑  

`.trim();
    if (teks !== 'all' && !getCategoryList().includes(teks)) {
      const listMenuRaw = ['all', ...getCategoryList()]
        .filter(
          (cat) =>
            (cat !== 'owner' || isOwner) &&
            (cat !== 'premium' || isPrems) &&
            (cat !== 'dev' || isMods)
        )
        .map((cat) => ({
          category: cat,
          count: countCommands(cat, isOwner, isPrems, isMods),
        }))
        .filter((item) => item.count > 0)
        .map((item, i) => [
          `${usedPrefix}menu ${item.category}`,
          (i + 1).toString(),
          `${categoryLabel(item.category)} (${item.count})\n> ${categoryDescription(item.category)}`,
        ]);
      const caption = `
${menuHeader}
`.trim();
      await conn.textList(m.chat, caption, config.media.image.thumbnail, listMenuRaw, m, {
        highlightLabel: '🔥 Show all features',
      });
      return;
    }
    const groups =
      teks === 'all'
        ? Object.fromEntries(
            ['all', ...getCategoryList()]
              .filter(
                ([cat]) =>
                  (cat !== 'owner' || isOwner) &&
                  (cat !== 'premium' || isPrems) &&
                  (cat !== 'dev' || isMods)
              )
              .map((cat) => [cat, getPluginsByCategory(cat, isOwner, isPrems)])
              .filter(([, cmds]) => cmds.length > 0)
          )
        : {
            [teks]: getPluginsByCategory(teks, isOwner, isPrems),
          };
    const menuText = [
      menuTemplate.before,
      ...Object.entries(groups).map(([tag, commands]) =>
        [
          menuTemplate.header
            .replace(/%category/g, categoryLabel(tag))
            .replace(/%icon/g, categoryLabel(tag)),
          commands
            .map((menu) =>
              menu.help
                .map((help) =>
                  menuTemplate.body
                    .replace(/%cmd/g, help.trim())
                    .replace(/%islimit/g, menu.limit ? ' 🅛' : '')
                    .replace(/%isPremium/g, menu.premium ? ' 🅟' : '')
                )
                .join('\n')
            )
            .join('\n'),
          menuTemplate.footer,
        ].join('\n')
      ),
      menuTemplate.after,
    ].join('\n');
    const replace = {
      '%': '%',
      p: usedPrefix,
      name,
      level,
      xp: exp,
      maxXp: xp,
      status,
      date: time,
      readmore: readMore,
    };
    const text = menuText.replace(/%(\w+)/g, (_, key) => replace[key] || '');
    await conn.sendMessage(
      m.chat,
      {
        video: {
          url: config.media.video.thumbnail.getRandom(),
        },
        caption: text.trim(),
        gifPlayback: true,
        mimetype: 'video/mp4',
      },
      {
        quoted: m,
      }
    );
  } catch (e) {
    return m.reply('Failed: ' + e.message);
  }
};
hikari.help = ['menu'];
hikari.command = /^(menu)$/i;
export default hikari;
const readMore = readmore();
const wish = () => {
  const hour = moment.tz('Asia/Jakarta').format('HH');
  return hour < 4
    ? '🌙 Good Night'
    : hour < 11
      ? '🌅 Good Morning'
      : hour < 15
        ? '🌞 Good Afternoon'
        : hour < 18
          ? '🌆 Good Evening'
          : '🌙 Good Night';
};
const clockString = (ms) => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  return [h, m, s].map((v) => v.toString().padStart(2, '0')).join(':');
};
const getCommandsByCategory = (category, isOwner, isPrems) =>
  Object.values(plugins)
    .filter(
      (plugin) =>
        !plugin.disabled &&
        (Array.isArray(plugin.category)
          ? plugin.category.includes(category)
          : plugin.category === category) &&
        (!plugin.premium || isPrems) &&
        (!plugin.owner || isOwner) &&
        Array.isArray(plugin.help) &&
        plugin.help.length > 0
    )
    .reduce((total, plugin) => total + plugin.help.length, 0);
const countCommands = (category, isOwner, isPrems, isMods) => {
  if (category === 'all') {
    return getCategoryList()
      .filter(
        (cat) =>
          (cat !== 'owner' || isOwner) &&
          (cat !== 'premium' || isPrems) &&
          (cat !== 'dev' || isMods)
      )
      .reduce((total, cat) => total + getCommandsByCategory(cat, isOwner, isPrems), 0);
  }
  return getCommandsByCategory(category, isOwner, isPrems);
};
const getPluginsByCategory = (category, isOwner, isPrems) =>
  Object.values(plugins)
    .filter(
      (plugin) =>
        !plugin.disabled &&
        (Array.isArray(plugin.category)
          ? plugin.category.includes(category)
          : plugin.category === category) &&
        (!plugin.premium || isPrems) &&
        (!plugin.owner || isOwner) &&
        Array.isArray(plugin.help) &&
        plugin.help.length > 0
    )
    .map((plugin) => ({
      help: plugin.help,
      limit: plugin.limit,
      premium: plugin.premium,
    }));
const toSHA256 = async (str) => {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(str).digest('hex');
};
