import fs from 'fs';
import { hkNet } from './network.js';
import crypto from 'crypto';
import config, { writeExampleConfig } from '#config';
import fsp from 'fs/promises';
import { ZipArchive } from 'archiver';
import { google } from 'googleapis';
import { db, resolveDbFile, storeByPrefix } from '#src/database';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import { PATH } from '#lib/utils/helper';
import YahooFinance from 'yahoo-finance2';
function getTime() {
  return new Date().toLocaleTimeString('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
let fdoc = {
  key: {
    remoteJid: 'status@broadcast',
    participant: '0@s.whatsapp.net',
  },
  message: {
    documentMessage: {
      title: '𝙱 𝙰 𝙲 𝙺 𝚄 𝙿 ',
    },
  },
};
async function resetAll() {
  try {
    let users = db.data.users;
    let chats = db.data.chats;
    let dataUsers = Object.keys(users).filter((userId) => users[userId].chat > 0);
    for (let userId of dataUsers) {
      if (users[userId].limit < 50) users[userId].limit = 50;
      users[userId].chat = 0;
      users[userId].command = 0;
    }
    let dataChats = Object.keys(chats).filter((chatId) => chatId.endsWith('@g.us'));
    for (let chatId of dataChats) {
      let userChat = chats[chatId].member;
      let activeUsers = Object.keys(userChat).filter((userId) => userChat[userId].chat > 0);
      for (let userId of activeUsers) {
        userChat[userId].chat = 0;
        userChat[userId].command = 0;
      }
    }
  } catch (error) {
    console.error('An error occurred while resetting:', error);
  }
}
async function resetStock() {
  const filePath = PATH.json + '/stock.json';
  const data = await fsp.readFile(filePath, 'utf8');
  const defaultStock = JSON.parse(data);
  if (!db.data) db.data = {};
  if (!db.data.bots) db.data.bots = {};
  if (!db.data.bots.stock) db.data.bots.stock = {};
  for (const key in defaultStock) {
    if (!(key in db.data.bots.stock)) {
      db.data.bots.stock[key] = defaultStock[key];
      continue;
    }
    const val = Number(db.data.bots.stock[key]) || 0;
    if (val === 0 || val > 5000) {
      db.data.bots.stock[key] = defaultStock[key];
    }
  }
  return db.data.bots.stock;
}
async function resetCryptoPrice() {
  try {
    let invest = db.data.bots.invest.item;
    let data = Object.keys(invest);
    for (let name of data) {
      invest[name].hargaBefore = invest[name].harga;
    }
  } catch (error) {
    console.error('An error occurred while resetting crypto prices:', error);
  }
}
async function resetSahamPrice() {
  try {
    let saham = db.data.bots.saham.item;
    let data = Object.keys(saham);
    for (let name of data) {
      saham[name].hargaBefore = saham[name].harga;
    }
  } catch (error) {
    console.error('An error occurred while resetting stock prices:', error);
  }
}
async function resetVolumeSaham() {
  try {
    let bot = db.data.bots;
    let data = Object.keys(bot.saham.item);
    for (let v of data) {
      let dataCrypto = bot.saham.item[v];
      dataCrypto.volumeBuy = 0;
      dataCrypto.volumeSell = 0;
      dataCrypto.open = dataCrypto.harga;
      dataCrypto.high = dataCrypto.harga;
      dataCrypto.low = dataCrypto.harga;
    }
  } catch (error) {
    console.error('An error occurred while resetting stock volume:', error);
  }
}
async function resetVolumeCrypto() {
  try {
    let bot = db.data.bots;
    let data = Object.keys(bot.invest.item);
    for (let v of data) {
      let dataCrypto = bot.invest.item[v];
      if (!dataCrypto) continue;
      if (!dataCrypto.open) dataCrypto.open = dataCrypto.harga;
      if (!dataCrypto.high) dataCrypto.high = dataCrypto.harga;
      if (!dataCrypto.low) dataCrypto.low = dataCrypto.harga;
      if (!dataCrypto.chart) dataCrypto.chart = {};
      let newChart = Date.now();
      dataCrypto.volumeBuy = 0;
      dataCrypto.volumeSell = 0;
      dataCrypto.open = dataCrypto.harga;
      dataCrypto.high = dataCrypto.harga;
      dataCrypto.low = dataCrypto.harga;
      dataCrypto.chart[newChart] = [
        dataCrypto.harga,
        dataCrypto.harga,
        dataCrypto.harga,
        dataCrypto.harga,
      ];
      dataCrypto.chartNow = newChart;
    }
  } catch (error) {
    console.error('An error occurred while resetting crypto volume:', error);
  }
}
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});
async function updateSaham() {
  try {
    const bot = db.data.bots;
    const saham = bot.saham.item;
    const symbols = Object.keys(saham);
    if (!symbols.length) return;
    const querySymbols = symbols.map((s) => `${s}.JK`);
    const result = await yahooFinance.quote(querySymbols);
    const now = Date.now();
    for (let data of Array.isArray(result) ? result : [result]) {
      const kode = data.symbol.replace('.JK', '');
      if (!saham[kode]) continue;
      saham[kode].harga = Math.round(data.regularMarketPrice);
      saham[kode].marketcap = data.marketCap || 0;
      saham[kode].volume = data.regularMarketVolume || 0;
      saham[kode].chart ??= {};
      saham[kode].chart[now] = [
        data.regularMarketOpen || data.regularMarketPrice,
        data.regularMarketDayHigh || data.regularMarketPrice,
        data.regularMarketDayLow || data.regularMarketPrice,
        data.regularMarketPrice,
      ];
      saham[kode].chartNow = now;
    }
  } catch (err) {
    console.error('❌ Failed to update stocks:', err.message);
  }
}
async function updateCrypto() {
  try {
    const crypto = db.data.bots.invest.item;
    const ids = Object.keys(crypto).join(',');
    const res = await hkNet.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'idr',
        ids,
      },
    });
    const result = res.data;
    for (let coin of result) {
      if (!crypto[coin.id]) continue;
      crypto[coin.id].hargaBefore = crypto[coin.id].harga;
      crypto[coin.id].harga = Math.round(coin.current_price);
      crypto[coin.id].marketcap = coin.market_cap || 0;
      crypto[coin.id].volume = coin.total_volume || 0;
      if (!crypto[coin.id].chart) crypto[coin.id].chart = {};
      const now = Date.now();
      crypto[coin.id].chart[now] = [
        coin.high_24h || coin.current_price,
        coin.high_24h || coin.current_price,
        coin.low_24h || coin.current_price,
        coin.current_price,
      ];
      crypto[coin.id].chartNow = now;
    }
  } catch (err) {
    console.error('❌ Error updating realtime crypto:', err.message);
  }
}
async function uploadBackupToGDrive(filePath, fileName) {
  try {
    const g = config?.backup?.gdrive || {};
    if (!g.enabled) return null;
    if (!g.clientId || !g.clientSecret || !g.refreshToken) {
      console.warn(
        'GDrive backup skipped: set backup.gdrive clientId/clientSecret/refreshToken in config.json'
      );
      return null;
    }
    const oAuth2Client = new google.auth.OAuth2(g.clientId, g.clientSecret);
    oAuth2Client.setCredentials({ refresh_token: g.refreshToken });
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    const res = await drive.files.create({
      requestBody: { name: fileName, parents: g.folderId ? [g.folderId] : undefined },
      media: { mimeType: 'application/zip', body: fs.createReadStream(filePath) },
      fields: 'id, name',
    });
    console.log('Backup uploaded to Google Drive:', res.data?.id);
    return res.data?.id || null;
  } catch (err) {
    console.error('GDrive backup failed:', err.message);
    return null;
  }
}
async function Backup(conn, force = false) {
  try {
    let setting = db?.data?.settings?.[conn.user.jid] || {};
    if (!setting.backup && !force) return;
    let tanggal = new Date().toLocaleDateString('id', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const dbName = global.opts?._?.[0] || config.bot.db || '';
    const databasePath = resolveDbFile(dbName);
    const databaseName = path.basename(databasePath);
    const databaseMime = 'application/x-sqlite3';
    if (!fs.existsSync(databasePath)) {
      console.error('❌ Database file not found');
      return;
    }
    try {
      db?.instance?.sqlite?.prepare?.('PRAGMA wal_checkpoint(TRUNCATE)')?.run?.();
    } catch {}
    const devOwners = config.owner.filter(([nomor, _, developer]) => nomor && developer);
    const backupDir = './backup';
    const namaFileZip = `${config.bot.name}-backup-${Date.now()}.zip`;
    const zipFilePath = path.join(backupDir, namaFileZip);
    if (!fs.existsSync(backupDir)) {
      await fsp.mkdir(backupDir, {
        recursive: true,
      });
    }
    for (let [jid] of devOwners) {
      const penerima = jid + '@s.whatsapp.net';
      await conn.reply(penerima, `📅 *Daily Backup:* ${tanggal}`, null, {
        quoted: fdoc,
      });
      await conn.sendMessage(penerima, {
        document: await fsp.readFile(databasePath),
        mimetype: databaseMime,
        fileName: databaseName,
      });
      const configPath = './config.json';
      if (fs.existsSync(configPath)) {
        await conn.sendMessage(penerima, {
          document: await fsp.readFile(configPath),
          mimetype: 'application/json',
          fileName: 'config.json',
        });
      }
    }
    for (const sub of conn.subbotControl?.profiles?.() ?? []) {
      try {
        const subDbPath = resolveDbFile(sub.db || sub.number);
        if (!fs.existsSync(subDbPath)) continue;
        try {
          storeByPrefix(sub.db || sub.number)
            ?.sqlite?.prepare?.('PRAGMA wal_checkpoint(TRUNCATE)')
            ?.run?.();
        } catch {}
        for (let [jid] of devOwners) {
          const penerima = jid + '@s.whatsapp.net';
          await conn.reply(
            penerima,
            `📅 *SubBot Backup (${sub.name || sub.number}):* ${tanggal}`,
            null,
            {
              quoted: fdoc,
            }
          );
          await conn.sendMessage(penerima, {
            document: await fsp.readFile(subDbPath),
            mimetype: 'application/x-sqlite3',
            fileName: path.basename(subDbPath),
          });
        }
      } catch (err) {
        console.error('SubBot backup failed:', sub?.number, err.message);
      }
    }
    const output = fs.createWriteStream(zipFilePath);
    const archive = new ZipArchive({
      zlib: {
        level: 9,
      },
    });
    output.on('error', (err) => {
      console.error('Error on output stream:', err.message);
    });
    output.on('close', async () => {
      await uploadBackupToGDrive(zipFilePath, namaFileZip);
      for (let [jid] of devOwners) {
        const penerima = jid + '@s.whatsapp.net';
        try {
          await conn.sendMessage(penerima, {
            document: await fsp.readFile(zipFilePath),
            mimetype: 'application/zip',
            fileName: namaFileZip,
          });
        } catch (err) {
          console.error('Failed to send ZIP file to', penerima, ':', err.message);
        }
      }
      setTimeout(async () => {
        if (fs.existsSync(zipFilePath)) {
          await fsp.unlink(zipFilePath);
        }
      }, 5000);
    });
    archive.on('error', (err) => {
      console.error('❌ Error while archiving:', err.message);
    });
    archive.pipe(output);
    const tambahFileKeArchive = async (direktori) => {
      const fileList = await fsp.readdir(direktori);
      for (const file of fileList) {
        const fullPath = path.join(direktori, file);
        const stat = await fsp.stat(fullPath);
        const relativePath = path.relative(process.cwd(), fullPath);
        const isExcluded =
          file === 'mongodb-backup.json' ||
          file === 'database.json' ||
          file === 'config.json' ||
          file === 'core' ||
          file === 'package-lock.json' ||
          file.endsWith('-wal') ||
          file.endsWith('-shm');
        const excludedDirs = [
          'sessions',
          'certs',
          'node_modules',
          'backup',
          'db',
          'src/bin',
          'tmp',
          'src/font',
          'src/json',
          'src/models',
          '__pycache__',
        ];
        const top = relativePath.split(path.sep)[0];
        const isDirExcluded =
          excludedDirs.some(
            (dir) => relativePath === dir || relativePath.startsWith(dir + path.sep)
          ) ||
          top === 'sessions' ||
          top.startsWith('sessions-');
        if (stat.isDirectory()) {
          if (!file.startsWith('.') && !isDirExcluded) {
            await tambahFileKeArchive(fullPath);
          }
        } else {
          if (isExcluded) continue;
          archive.file(fullPath, {
            name: relativePath,
          });
        }
      }
    };
    await tambahFileKeArchive('./');
    const examplePath = writeExampleConfig();
    archive.file(examplePath, {
      name: 'example.config.json',
    });
    await archive.finalize();
  } catch (error) {
    console.error('❌ An error occurred during backup:', error.message);
  }
}
async function clearMemory(conn) {
  if (conn?.spam) conn.spam = {};
  if (conn?.khodam) conn.khodam = {};
  const isBun = typeof Bun !== 'undefined';
  if (!isBun) {
    if (global?.gc) global.gc();
  }
}
async function checkGempa(conn) {
  try {
    let chat = db.data.chats;
    let bot = db.data.bots;
    let now = new Date().getTime();
    let apiResponse = await hkNet.get('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json');
    let gempa = apiResponse.data.Infogempa.gempa;
    if (gempa.DateTime !== bot.gempaDateTime) {
      bot.gempaDateTime = gempa.DateTime;
      let groups = Object.entries(conn.chats)
        .filter(
          ([jid, chat]) =>
            jid.endsWith('@g.us') &&
            chat.isChats &&
            !chat.metadata?.read_only &&
            !chat.metadata?.announce &&
            !chat.isCommunity &&
            !chat.isCommunityAnnounce &&
            !chat?.metadata?.isCommunity &&
            !chat?.metadata?.isCommunityAnnounce
        )
        .map((v) => v[0]);
      for (let number of groups) {
        if (chat[number].notifgempa && gempa.DateTime !== chat[number].gempaDateTime) {
          chat[number].gempaDateTime = gempa.DateTime;
          let caption = `
*BMKG Earthquake Alert!*

Coordinates: ${gempa.Coordinates}
Magnitude: ${gempa.Magnitude}
Depth: ${gempa.Kedalaman}

_Region: ${gempa.Wilayah}, Tsunami potential: ${gempa.Potensi}_

_Residents in the *${gempa.Dirasakan}* area are advised to stay alert!_
                    `.trim();
          await conn.sendFile(
            number,
            'https://data.bmkg.go.id/DataMKG/TEWS/' + gempa.Shakemap,
            'map.jpg',
            caption,
            false
          );
        }
      }
    }
  } catch (error) {
    console.error('An error occurred in checkGempa:', error.message);
  }
}
async function checkSewa(conn) {
  let chat = db.data.chats;
  let data = Object.keys(chat).filter(
    (v) => chat[v].expired > 0 && new Date().getTime() - chat[v].expired > 0
  );
  for (let number of data) {
    try {
      let groupMetadata = await conn.groupMetadata(number);
      await conn.reply(
        number,
        `Time for *${conn.user.name}* to leave the Group\nDon't forget to renew your subscription!`,
        null
      );
      await conn.sendContact(number, config.owner, null);
      await conn.groupLeave(number);
      chat[number].expired = 0;
    } catch (error) {
      console.error(`Error while processing group ${number}:`, error.message);
      chat[number].expired = 0;
    }
  }
}
async function checkPremium(conn) {
  try {
    let user = db.data.users;
    let data = Object.keys(user).filter(
      (v) => user[v].premiumTime > 0 && new Date().getTime() - user[v].premiumTime > 0
    );
    for (let number of data) {
      try {
        let name = user[number].registered ? user[number].name : await conn.getName(number);
        await conn.reply(
          number,
          `Hello ${name} \nYour premium time has expired, if you want to extend it please chat the owner's number below!`,
          null
        );
        await conn.sendContact(number, config.owner, null);
        user[number].premiumTime = 0;
        user[number].premium = false;
        user[number].noPrefix = false;
        user[number].autodownload = false;
        user[number].autoAi = false;
      } catch (error) {
        console.error(`Error while processing user ${number}:`, error.message);
      }
    }
  } catch (error) {
    console.error('An error occurred in checkPremium:', error.message);
  }
}
function clearTmp() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  if (!fs.existsSync(PATH.tmp)) {
    console.log('tmp folder not found, skipping cleanup');
    return;
  }
  let filenames = [];
  try {
    fs.readdirSync(PATH.tmp).forEach((file) => {
      filenames.push(path.join(PATH.tmp, file));
    });
  } catch (err) {
    console.error(`Error reading directory ${PATH.tmp}:`, err);
    return;
  }
  let deletedCount = 0;
  filenames.forEach((file) => {
    try {
      let stats = fs.statSync(file);
      if (stats.isFile() && Date.now() - stats.mtimeMs >= 1000 * 60 * 5) {
        fs.unlinkSync(file);
        deletedCount++;
        console.log(`🗑️ Deleted old temp file: ${path.basename(file)}`);
      }
    } catch (err) {
      console.error(`Error processing file ${file}:`, err);
    }
  });
  if (deletedCount > 0) {
    console.log(`✅ Cleaned up ${deletedCount} old temp files`);
  } else {
    console.log('📁 No old temp files to clean');
  }
}
async function autoScheduleGroups(conn) {
  try {
    const chats = db.data.chats;
    if (!chats) {
      return;
    }
    const now = new Date();
    const wibTime = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const hours = parseInt(wibTime.find((part) => part.type === 'hour').value);
    const minutes = parseInt(wibTime.find((part) => part.type === 'minute').value);
    const autoScheduleGroups = Object.entries(chats).filter(
      ([chatId, chatData]) => chatId.endsWith('@g.us') && chatData.autoSchedule === true
    );
    if (autoScheduleGroups.length === 0) {
      return;
    }
    const today = now.toDateString();
    if (!global.scheduleTracker) {
      global.scheduleTracker = {
        date: today,
        closedGroups: new Set(),
        openedGroups: new Set(),
      };
    }
    if (global.scheduleTracker.date !== today) {
      global.scheduleTracker.date = today;
      global.scheduleTracker.closedGroups.clear();
      global.scheduleTracker.openedGroups.clear();
    }
    const setting = db.data.settings[conn.user.jid] || {};
    for (const [chatId, chatData] of autoScheduleGroups) {
      try {
        const groupMetadata = await conn.groupMetadata(chatId).catch(() => null);
        if (!groupMetadata) {
          continue;
        }
        if (hours === 0 && minutes >= 0 && minutes <= 5) {
          if (!global.scheduleTracker.closedGroups.has(chatId)) {
            await conn.groupSettingUpdate(chatId, 'announcement');
            if (setting.composing) await conn.sendPresenceUpdate('composing', chatId);
            await conn.sendMessage(chatId, {
              text:
                `🌙 *Group Closed Automatically*\n\n` +
                `The group will be closed from 00:00 - 04:00 WIB\n` +
                `Only admins can send messages\n` +
                `The group will automatically reopen at 04:00 AM WIB\n\n` +
                `Rest well! 😴`,
            });
            global.scheduleTracker.closedGroups.add(chatId);
          }
        }
        if (hours === 4 && minutes >= 0 && minutes <= 5) {
          if (!global.scheduleTracker.openedGroups.has(chatId)) {
            await conn.groupSettingUpdate(chatId, 'not_announcement');
            if (setting.composing) await conn.sendPresenceUpdate('composing', chatId);
            await conn.sendMessage(chatId, {
              text:
                `🌅 *Group Opened Automatically*\n\n` +
                `Good morning! The group has been opened\n` +
                `All members can send messages again\n` +
                `The group will automatically close at 00:00 WIB\n\n` +
                `Have a great day! ☀️`,
            });
            global.scheduleTracker.openedGroups.add(chatId);
          }
        }
      } catch (error) {
        console.error(`[AUTO-SCHEDULE] Error processing group ${chatId}:`, error.message);
      }
    }
  } catch (error) {
    console.error('[AUTO-SCHEDULE] Error in autoScheduleGroups:', error.message);
  }
}
async function resetWeeklyChat() {
  for (const chatId in db.data.chats) {
    const chat = db.data.chats[chatId];
    if (!chat?.member) continue;
    for (const jid in chat.member) {
      chat.member[jid].chat = 0;
      chat.member[jid].chatTotal = 0;
    }
  }
}
async function clearDatabase() {
  const users = db.data.users;
  if (!users) return;
  for (const [id, user] of Object.entries(users)) {
    if (!id) {
      delete users[id];
      continue;
    }
    if (
      id.includes('@g.us') ||
      id.includes('@lid') ||
      id.includes('broadcast') ||
      id.includes('undefined')
    ) {
      delete users[id];
      continue;
    }
    if (!user.registered && !user.unreg) {
      delete users[id];
      continue;
    }
  }
}
async function checkSholat(conn) {
  try {
    let bot = db.data.bots;
    let chat = db.data.chats;
    let groups = Object.entries(conn.chats)
      .filter(
        ([jid, chat]) =>
          jid.endsWith('@g.us') &&
          chat.isChats &&
          !chat.metadata?.read_only &&
          !chat.metadata?.announce &&
          !chat.isCommunity &&
          !chat.isCommunityAnnounce &&
          !chat?.metadata?.isCommunity &&
          !chat?.metadata?.isCommunityAnnounce
      )
      .map((v) => v[0]);
    let jadwalsholat = Object.keys(bot.jadwalsholat.list);
    for (let i = 0; i < jadwalsholat.length; i++) {
      let currentPrayer = jadwalsholat[i];
      let prayerTime = bot.jadwalsholat.list[currentPrayer];
      let now = getTime();
      if (prayerTime === now && bot.jadwalsholat.now !== currentPrayer) {
        bot.jadwalsholat.now = currentPrayer;
        let audioUrl =
          currentPrayer === 'Shubuh'
            ? 'https://pomf2.lain.la/f/ly4t9rxt.opus'
            : 'https://pomf2.lain.la/f/k0dsbnsp.opus';
        for (let chatId of groups) {
          try {
            if (chat[chatId]?.notifazan && chat[chatId]?.sholatNow !== currentPrayer) {
              chat[chatId].sholatNow = currentPrayer;
              let thumbnail = (await conn.getFile('https://pomf2.lain.la/f/8joxeij1.jpg')).data;
              await conn.sendFile(chatId, audioUrl, '', '', null, null, {
                contextInfo: {
                  externalAdReply: {
                    showAdAttribution: false,
                    mediaType: 1,
                    title: `Azan ${currentPrayer} Has Started`,
                    body: 'For the Jakarta area and surrounding regions.',
                    thumbnail: thumbnail,
                    renderLargerThumbnail: true,
                    mediaUrl: '',
                    sourceUrl: '',
                  },
                },
              });
            }
          } catch (error) {
            console.error(`Error sending message to chat ${chatId}:`, error.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('An error occurred in checkSholat:', error.message);
  }
}
export {
  resetAll,
  Backup,
  clearMemory,
  checkGempa,
  checkPremium,
  checkSewa,
  clearTmp,
  autoScheduleGroups,
  resetCryptoPrice,
  resetVolumeCrypto,
  updateCrypto,
  resetSahamPrice,
  resetVolumeSaham,
  updateSaham,
  resetWeeklyChat,
  clearDatabase,
  resetStock,
  checkSholat,
};
