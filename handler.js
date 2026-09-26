import config from '#config';
import { printMessage } from '#lib/utils/print';
import { PATH, filename, readmore } from '#lib/utils/helper';
import { smsg } from '#lib/utils/simple';
import { plugins } from '#src/plugins';
import { loadDatabase, db } from '#src/database';
import { dfail } from '#lib/router/dfail';
import { isRateLimitError } from '#lib/router/errors';
import { checkSpam } from '#lib/router/spam';
import { parseFlags } from '#lib/router/flags';
import {
  defaultUserConfig,
  defaultChatConfig,
  defaultSettingsConfig,
  defaultBotConfig,
  defaultMemberConfig,
} from '#src/default';
import { format } from 'util';
import { fileURLToPath } from 'url';
import path, { join } from 'path';
import { unwatchFile, watchFile } from 'fs';
import chalk from 'chalk';
import fs from 'fs';
const isNumber = (x) => typeof x === 'number' && !isNaN(x);
const initializeObject = (obj = {}, defaults) => {
  const initialized = {
    ...obj,
  };
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (initialized[key] === undefined || initialized[key] === null) {
      initialized[key] = defaultValue;
    } else {
      const val = initialized[key];
      const defaultType = typeof defaultValue;
      const valType = typeof val;
      if (defaultType === 'number' && !isNumber(val)) initialized[key] = defaultValue;
      else if (defaultType === 'boolean' && valType !== 'boolean') initialized[key] = defaultValue;
      else if (defaultType === 'string' && valType !== 'string') initialized[key] = defaultValue;
      else if (Array.isArray(defaultValue) && !Array.isArray(val)) initialized[key] = defaultValue;
      else if (
        defaultType === 'object' &&
        !Array.isArray(defaultValue) &&
        defaultValue !== null &&
        (valType !== 'object' || Array.isArray(val))
      ) {
        initialized[key] = defaultValue;
      }
    }
  }
  return initialized;
};
const exemptPlugins = new Set([
  'exp/login.js',
  'exp/logout.js',
  'fun/suitpvp_ans.js',
  '_cekVerifCode.js',
  'game/werewolf_ans.js',
  'rpg/referal.js',
  'main/sewa.js',
  'main/premium.js',
  'info/owner.js',
  'exp/daftar.js',
  'exp/verified.js',
  'info/limit.js',
]);
const bannedPlugins = new Set([
  'group/modebot.js',
  'owner/unbanchat.js',
  'dev/exec.js',
  'dev/command.js',
  'tool/delete.js',
]);
const unbannedPlugins = new Set(['group/unbanuser.js', 'info/cekbanned.js']);
const groupMetadataCache = new Map();
const GROUP_METADATA_TTL = 30000;

async function getGroupMetadata(conn, jid) {
  const now = Date.now();
  const cached = groupMetadataCache.get(jid);
  if (cached && now - cached.ts < GROUP_METADATA_TTL) {
    return cached.data;
  }
  try {
    const data = await conn.groupMetadata(jid);
    groupMetadataCache.set(jid, { ts: now, data });
    return data;
  } catch {
    return null;
  }
}

const str2Regex = (str) => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');

export async function handler(chatUpdate) {
  this.msgqueque = this.msgqueque || [];
  if (!chatUpdate) return;
  this.pushMessage(chatUpdate.messages).catch(console.error);
  for (const rawMsg of chatUpdate.messages || []) {
    let m = rawMsg;
    if (!m) continue;
    if (db.data == null) await loadDatabase();
    try {
      m = (await smsg(this, m)) || m;
      let originalText = m.text;
      if (db.data.users[m.sender]?.noPrefix && !/^[~!@#$%^&.+=>]/.test(m.text)) {
        m.text = '.' + m.text;
        m.noPrefixInjected = true;
        m.originalText = originalText;
      }
      if (m.message?.buttonsResponseMessage) {
        m.text = m.message.buttonsResponseMessage.selectedButtonId;
      }
      const flowId = (() => {
        try {
          const paramsJson = m.message?.nativeFlowResponseMessage?.paramsJson;
          if (typeof paramsJson === 'string' && paramsJson) {
            const id = JSON.parse(paramsJson)?.id;
            if (typeof id === 'string' && id) return id;
          }
          const listReply =
            m.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
            m.message?.listResponseMessage?.selectedId ||
            m.message?.templateButtonReplyMessage?.selectedId;
          if (typeof listReply === 'string' && listReply) return listReply;
        } catch {}
        return null;
      })();
      if (
        typeof flowId === 'string' &&
        flowId.length <= 128 &&
        /^[\w:._/?=&@%#+~-]+(?:\s+[\w:._/?=&@%#+~-]+){0,6}$/.test(flowId)
      ) {
        const cmd = flowId.replace(/^id:/i, '');
        let dp = '.';
        try {
          if (typeof this.prefix === 'string' && this.prefix) dp = this.prefix[0];
          else if (typeof opts?.['prefix'] === 'string' && opts['prefix']) dp = opts['prefix'][0];
        } catch {}
        const esc = dp.replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&');
        m.text = new RegExp(`^[${esc}]`).test(cmd) ? cmd : dp + cmd;
        m.buttonClick = true;
      }
      const senderOk = /^\d+@s\.whatsapp\.net$/.test(m.sender) || /^\d+@lid$/.test(m.sender);
      const chatOk =
        /^\d+@s\.whatsapp\.net$/.test(m.chat) ||
        /^\d+(-\d+)?@g\.us$/.test(m.chat) ||
        /^\d+@lid$/.test(m.chat);
      if (!m || !senderOk || !chatOk) continue;
      m.exp = 0;
      m.limit = false;
      m.energy = false;
      const { sender, chat, fromMe } = m;
      const isGroup = chat.endsWith('@g.us');
      const botJid = this.user?.jid;
      const userDb = db.data.users[sender] || {};
      db.data.users[sender] = initializeObject(userDb, defaultUserConfig);
      if (!userDb.registered) {
        db.data.users[sender].name = m.name;
        db.data.users[sender].age = -1;
        db.data.users[sender].regTime = -1;
      }
      const chatDb = db.data.chats[chat] || {};
      db.data.chats[chat] = initializeObject(chatDb, defaultChatConfig);
      if (isGroup) {
        if (!db.data.chats[chat].member) db.data.chats[chat].member = {};
        const memberDb = db.data.chats[chat].member[sender] || {};
        db.data.chats[chat].member[sender] = initializeObject(memberDb, defaultMemberConfig);
      }
      if (botJid) {
        const settingsDb = db.data.settings[botJid] || {};
        db.data.settings[botJid] = initializeObject(settingsDb, defaultSettingsConfig);
      }
      const botData = db.data.bots || {};
      db.data.bots = initializeObject(botData, defaultBotConfig);
      const owners = this.botProfile?.owner ?? config.owner;
      const isMods = owners.some(
        ([number, _, isDeveloper]) => isDeveloper && number + '@s.whatsapp.net' === m.sender
      );
      const isOwner =
        isMods || m.e || owners.some(([number]) => number + '@s.whatsapp.net' === m.sender);
      const isPrems = isOwner || (db.data.users[m.sender]?.premiumTime ?? 0) > Date.now();
      if (opts['queque'] && m.text && !isPrems) {
        let queque = this.msgqueque;
        const time = 5000;
        const messageId = m.id || m.key.id;
        queque.push(messageId);
        const timeoutId = setTimeout(() => {
          const index = queque.indexOf(messageId);
          if (index !== -1) queque.splice(index, 1);
          this.queueTimeouts?.delete(messageId);
        }, time);
        if (!this.queueTimeouts) this.queueTimeouts = new Map();
        this.queueTimeouts.set(messageId, timeoutId);
      }
      m.exp += Math.ceil(Math.random() * 10);
      const groupMetadata = m.isGroup ? await getGroupMetadata(this, m.chat) : {};
      const participants = m.isGroup && groupMetadata ? groupMetadata.participants || [] : [];
      const user = m.isGroup
        ? participants.find((u) => this.decodeJid(u.phoneNumber) === m.key.senderPn)
        : {};
      const bot = m.isGroup
        ? participants.find((u) => this.decodeJid(u.phoneNumber) === this.decodeJid(this.user.id))
        : {};
      const isRAdmin = user?.admin === 'superadmin';
      const isAdmin = isRAdmin || user?.admin === 'admin';
      const isBotAdmin = bot?.admin === 'superadmin' || bot?.admin === 'admin';
      const ___dirname = path.dirname(fileURLToPath(import.meta.url));
      const prefix = new RegExp(
        `^[${(opts['prefix'] || '‚Äã/!#.\\').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&')}]`
      );
      const hasText = typeof m.text === 'string' && m.text.length > 0;
      for (const name of Object.keys(plugins)) {
        let plugin = plugins[name];
        if (!plugin || plugin.disabled) continue;
        const __filename = join(___dirname, './plugins', name);
        if (typeof plugin.all === 'function') {
          try {
            await plugin.all.call(this, m, {
              chatUpdate,
              __dirname: ___dirname,
              __filename,
            });
          } catch (e) {
            console.error(e);
            if (
              !db.data.settings[this.user.jid]?.noerror &&
              !/AggregateError|Media upload failed/i.test(e)
            ) {
              for (let [jid] of (this.botProfile?.owner ?? config.owner).filter(
                ([, , isDev]) => isDev
              )) {
                let data = (await this.onWhatsApp(jid))[0] || {};
                if (data.exists)
                  await m.reply(
                    `*Plugin:* ${name}\n*Sender:* ${m.sender}\n*Chat:* ${m.chat}\n*Command:* ${m.text}\n\n\`\`\`${format(e)}\`\`\``.trim(),
                    data.jid
                  );
              }
            }
          }
        }
        if (!opts['restrict'] && plugin.category?.includes('admin')) continue;
        const hasCommand = plugin.command != null;
        const hasCustomPrefix = plugin.customPrefix != null;
        const hasAllHook = typeof plugin.all === 'function';
        const hasBeforeHook = typeof plugin.before === 'function';
        if (!hasCommand && !hasCustomPrefix && !hasAllHook && !hasBeforeHook) continue;
        if (!hasText && !hasBeforeHook) continue;
        let _prefix = plugin.customPrefix ?? this.prefix ?? prefix;
        let match = (
          _prefix instanceof RegExp
            ? [[_prefix.exec(m.text), _prefix]]
            : Array.isArray(_prefix)
              ? _prefix.map((p) => [
                  (p instanceof RegExp ? p : new RegExp(str2Regex(p))).exec(m.text),
                  p,
                ])
              : typeof _prefix === 'string'
                ? [[new RegExp(str2Regex(_prefix)).exec(m.text), new RegExp(str2Regex(_prefix))]]
                : [[[], new RegExp()]]
        ).find((p) => p[1] && p[0]);
        if (typeof plugin.before === 'function') {
          if (
            await plugin.before.call(this, m, {
              match,
              conn: this,
              participants,
              groupMetadata,
              user,
              bot,
              isMods,
              isOwner,
              isRAdmin,
              isAdmin,
              isBotAdmin,
              isPrems,
              isGroup: m.isGroup,
              chatUpdate,
              __dirname: ___dirname,
              __filename,
              dfail,
            })
          )
            continue;
        }
        if (typeof plugin !== 'function' || !match || !match[0]) continue;
        const usedPrefix = match[0][0];
        let noPrefix = m.text.replace(usedPrefix, '');
        const trimmed = noPrefix.trim();
        const parts = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
        const command = (parts[0] || '').toLowerCase();
        const args = parts.slice(1);
        let text = parts.length ? trimmed.slice(command.length).trim() : '';
        let flags;
        let cleanText;
        if (plugin.noParse) {
          flags = null;
          cleanText = null;
        } else {
          const parse = parseFlags(text, config);
          flags = parse.flags;
          cleanText = parse.cleanText;
        }
        text = plugin.noParse ? text : cleanText;
        const isAccept =
          plugin.command instanceof RegExp
            ? plugin.command.test(command)
            : Array.isArray(plugin.command)
              ? plugin.command.some((cmd) =>
                  cmd instanceof RegExp ? cmd.test(command) : cmd === command
                )
              : typeof plugin.command === 'string'
                ? plugin.command === command
                : false;
        if (!isAccept) continue;
        m.plugin = name;
        const userDb = db.data.users[m.sender];
        const chatDb = db.data.chats[m.chat];
        const userGroupDb = db.data.chats[m.chat]?.member?.[m.sender];
        const settingDb = db.data.settings[this.user.jid];
        if (
          m.isGroup &&
          Array.isArray(chatDb.banFitur) &&
          chatDb.banFitur.includes(command) &&
          !isOwner &&
          !isMods
        ) {
          await m.reply(
            `🚫 *This feature is blocked in this group by the admin.*\n\n` +
              `🛠️ Command: *${command}*`
          );
          continue;
        }
        if (typeof m.text !== 'string') m.text = '';
        if (opts['self'] || config.bot.mode == 'self') {
          if (!m.fromMe && !isOwner) break;
        }
        if (opts['pconly'] && m.isGroup) break;
        const isExempt = exemptPlugins.has(name) || exemptPlugins.has(name.replace('.js', ''));
        if (opts.gconly && !m.chat.includes('@g.us') && !isPrems && !isExempt) {
          if (Date.now() - userDb.pc > 21600000) {
            try {
              if (settingDb.composing) await this.sendPresenceUpdate('composing', m.chat);
              if (settingDb.autoread) await this.readMessages([m.key]);
              const teks = `Hello, ${await this.getName(m.sender)}\n\nSorry, ${this.user.name} is currently in *Group Only* mode. To use the bot in Private Chat, you must be a *Premium User*.\nType *!premium* for more info.\n or join the bot's official group at ${config.group}`;
              await this.adReply(
                m.chat,
                teks,
                config.watermark,
                null,
                config.media.image.thumbnail,
                config.group,
                m
              );
              userDb.pc = Date.now();
            } catch (err) {
              console.error(err);
            }
          }
          break;
        }
        if (userDb?.banned && userDb.bannedTime && Date.now() > userDb.bannedTime) {
          userDb.banned = false;
          userDb.bannedTime = 0;
        }
        if (chatDb?.isBanned || chatDb?.mute) {
          if (!bannedPlugins.has(name)) break;
        }
        if (userDb?.banned || userGroupDb?.banned) {
          if (!unbannedPlugins.has(name)) break;
        }
        if (chatDb?.adminOnly && !isAdmin && name !== 'group/info.js') break;
        if (!isPrems && !isExempt && userDb.command >= userDb.commandLimit) {
          if (Date.now() - userDb.cmdLimitMsg > 600000) {
            if (settingDb.composing)
              await this.sendPresenceUpdate('composing', m.chat).catch(() => {});
            if (settingDb.autoread) await this.readMessages([m.key]).catch(() => {});
            await m.reply(
              `Your command limit has run out (${userDb.command}/${userDb.commandLimit}). It resets at midnight.\n\n` +
                (!userDb.verif
                  ? '_Verify your account with *#verif* to get 1000 command limit._'
                  : '_Upgrade to Premium for an Unlimited Command Limit._')
            );
            userDb.cmdLimitMsg = Date.now();
          }
          break;
        }
        isExempt ? userDb.command * 1 : userDb.command++;
        userDb.commandTotal++;
        userDb.lastCmd = Date.now();
        if (m.isGroup && userGroupDb) {
          userGroupDb.command++;
          userGroupDb.commandTotal++;
          userGroupDb.lastCmd = Date.now();
        }
        if (settingDb.composing) await this.sendPresenceUpdate('composing', m.chat).catch(() => {});
        if (settingDb.autoread) await this.readMessages([m.key]).catch(() => {});
        if (checkSpam(m.sender) && !isMods && !isOwner) {
          const banDuration = isPrems ? 5000 : 30000;
          const msg = `No Spam Commands! Please wait ${banDuration / 1000} seconds.`;
          await m.reply(msg);
          userDb.banned = true;
          userDb.bannedTime = Date.now() + banDuration;
          break;
        }
        const checks = {
          owner: {
            check: !isOwner,
            fail: 'owner',
          },
          mods: {
            check: !isMods,
            fail: 'mods',
          },
          premium: {
            check: !isPrems,
            fail: 'premium',
          },
          group: {
            check: !m.isGroup,
            fail: 'group',
          },
          private: {
            check: m.isGroup,
            fail: 'private',
          },
          admin: {
            check: m.isGroup && !isAdmin,
            fail: 'admin',
          },
          botAdmin: {
            check: m.isGroup && !isBotAdmin,
            fail: 'botAdmin',
          },
          register: {
            check: !userDb.registered,
            fail: 'unreg',
          },
          onlyprem: {
            check: !m.isGroup && !isPrems,
            fail: 'onlyprem',
          },
          rpg: {
            check: m.isGroup && !chatDb.rpg,
            fail: 'rpg',
          },
          game: {
            check: m.isGroup && !chatDb.game,
            fail: 'game',
          },
          nsfw: {
            check: m.isGroup && !chatDb.nsfw,
            fail: 'nsfw',
          },
        };
        let failedCheck = false;
        for (const key in checks) {
          if (plugin[key] && checks[key].check) {
            await dfail(checks[key].fail, m, this);
            failedCheck = true;
            break;
          }
        }
        if (failedCheck) continue;
        m.isCommand = true;
        let xp = 'exp' in plugin ? parseInt(plugin.exp) : 17;
        if (xp > 200) await m.reply('Nice try -_-');
        else m.exp += xp;
        if (!isPrems && plugin.limit && userDb.limit < plugin.limit * 1 && !isExempt) {
          await dfail('limitExp', m, this);
          continue;
        }
        if (plugin.energy && userDb.energy < plugin.energy * 1) {
          await dfail('energy', m, this);
          continue;
        }
        if (plugin.level > userDb.level) {
          await this.adReply(
            m.chat,
            `To use this feature, you need to be at level ${plugin.level}`,
            'ACCESS DENIED',
            config.watermark,
            config.media.image.denied,
            config.website,
            m
          );
          continue;
        }
        if (plugin.age > userDb.age) {
          await this.adReply(
            m.chat,
            `To use this feature, you must be ${plugin.age} years old`,
            'ACCESS DENIED',
            config.watermark,
            config.media.image.denied,
            config.website,
            m
          );
          continue;
        }
        let extra = {
          match,
          usedPrefix,
          noPrefix,
          args,
          command,
          text,
          flags,
          conn: this,
          participants,
          groupMetadata,
          user,
          bot,
          isMods,
          isOwner,
          isRAdmin,
          isAdmin,
          isBotAdmin,
          isPrems,
          isGroup: m.isGroup,
          chatUpdate,
          __dirname: ___dirname,
          __filename,
          dfail,
        };
        async function sendErrorLogToDev(m, text, command, args) {
          if (isRateLimitError(m.error)) {
            return;
          }
          for (let [jid] of (m?.conn?.botProfile?.owner ?? config.owner).filter(
            ([, , isDev]) => isDev
          )) {
            let data = (await m?.conn?.onWhatsApp(jid))[0] || {};
            if (data.exists) {
              await m.reply(
                `*🗂️ Plugin:* ${m.plugin}\n*👤 Sender:* ${m.sender}\n*💬 Chat:* ${m.chat}\n*💻 Command:* ${usedPrefix}${command} ${args.join(' ')}\n📄 *Error Logs:*\n\n\`\`\`${text}\`\`\``.trim(),
                data.jid
              );
            }
          }
        }
        function loading(back = false) {
          return this.sendReact(m.chat, back ? '' : '🕒', m.key);
        }
        try {
          try {
            await this.sendReact(m.chat, '🕒', m.key);
          } catch (e) {}
          await plugin.call(this, m, extra);
          m.energy = m.energy ?? plugin.energy ?? false;
          if (!isPrems) m.limit = m.limit ?? plugin.limit ?? false;
        } catch (e) {
          m.error = e;
          console.error(e);
          if (isRateLimitError(e)) {
            try {
              await m.reply(
                'error: rate-overlimit\nif this persists, try using this feature in a private chat'
              );
            } catch {}
            break;
          }
          if (settingDb.noerror) {
            try {
              await m.reply(config.errorMsg);
            } catch {}
          } else if (e) {
            let errorText = format(e);
            if (e.name) {
              try {
                await sendErrorLogToDev(m, errorText, command, args);
              } catch {}
            }
            plugin.error = (plugin.error || 0) + 1;
            const readMore = readmore();
            try {
              await m.reply(
                `*[ Whoops ]* Looks like this feature is erroring out!\n\rIt will be disabled if it keeps happening.\n${readMore}\n\nError: ${e.message || e}`
              );
            } catch {}
            if (plugin.error >= 5) {
              plugin.disabled = true;
              try {
                await m.reply(
                  `*[ Oops ] Feature ${m.plugin || command} has been disabled because it keeps erroring...*`
                );
              } catch {}
            }
          }
        } finally {
          if (!isRateLimitError(m.error)) {
            try {
              await this.sendReact(m.chat, '', m.key);
            } catch {}
          }
          if (typeof plugin.after === 'function') {
            try {
              await plugin.after.call(this, m, extra);
            } catch (err) {
              console.error('plugin.after error:', err);
            }
          }
        }
        break;
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (m.noPrefixInjected && !m.isCommand) {
        m.text = m.originalText;
      }
      if (opts['queque'] && m.text) {
        const messageId = m.id || m.key.id;
        const quequeIndex = this.msgqueque.indexOf(messageId);
        if (quequeIndex !== -1) this.msgqueque.splice(quequeIndex, 1);
        if (this.queueTimeouts?.has(messageId)) {
          clearTimeout(this.queueTimeouts.get(messageId));
          this.queueTimeouts.delete(messageId);
        }
      }
      let user = db.data.users[m.sender];
      if (m && m.sender && user) {
        user.exp += m.exp;
        user.limit -= m.limit * 1;
        user.energy -= m.energy * 1;
        user.chat++;
        user.chatTotal++;
        user.lastseen = Date.now();
      }
      if (m.isGroup && m.sender && db.data.chats[m.chat]?.member?.[m.sender]) {
        const member = db.data.chats[m.chat].member[m.sender];
        member.chat++;
        member.chatTotal++;
        member.lastseen = Date.now();
      }
      try {
        if (!opts['noprint']) await printMessage(m, this);
      } catch (e) {
        console.log(m, m.quoted, e);
      }
    }
  }
}
let file = filename(import.meta.url, true);
watchFile(file, async () => {
  unwatchFile(file);
  console.log(chalk.redBright('Reloading handler.js...'));
  if (global.reloadHandler) {
    await global.reloadHandler();
    console.log(chalk.green('handler.js reloaded successfully.'));
  }
});
