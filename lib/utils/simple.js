import util from 'util';
import { fileTypeFromBuffer } from 'file-type';
import store from '#lib/utils/store';
import config from '#config';
import { createSocketContext, attachSocket } from '../socket/index.js';
import {
  makeWASocket as _makeWaSocket,
  proto,
  jidDecode,
  areJidsSameUser,
  extractMessageContent,
} from 'baileys';
function isPnUser(id) {
  if (id.endsWith('@s.whatsapp.net')) {
    return true;
  } else {
    return false;
  }
}
function isLidUser(id) {
  if (id.endsWith('@lid')) {
    return true;
  } else {
    return false;
  }
}
function isJidNewsletter(id) {
  if (id.endsWith('@newsletter')) {
    return true;
  } else {
    return false;
  }
}
function safeParseJson(v) {
  if (typeof v !== 'string') return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}
function cleanObject(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null));
}
export async function smsg(conn, m, hasParent) {
  if (!m) return m;
  const ensureJid = async (v) => {
    try {
      if (!v) return v;
      if (typeof v !== 'string') return v;
      if (v.endsWith('@s.whatsapp.net')) return v;
      if (v.endsWith('@lid')) return (await conn?.resolveJid?.(v, 'pn')) || v;
      return v;
    } catch {
      return v;
    }
  };
  const ensureLid = async (v) => {
    try {
      if (!v) return v;
      if (typeof v !== 'string') return v;
      if (v.endsWith('@lid')) return v;
      if (v.endsWith('@s.whatsapp.net')) return (await conn?.resolveJid?.(v, 'pn')) || v;
      return v;
    } catch {
      return v;
    }
  };
  const isGroupKey = (k) => !!k?.participant || String(k?.remoteJid || '').endsWith('@g.us');
  const decode = (v) => conn?.decodeJid?.(v) || v;
  const getCtxInfo = (mm) => {
    const raw = mm?.raw?.message;
    if (!raw) return;
    const t = Object.keys(raw)[0];
    return raw[t]?.contextInfo;
  };
  const coerceStr = (v) => (typeof v === 'string' ? v : '');
  const raw = {
    ...m,
  };
  const M = proto.WebMessageInfo;
  m = M.create(m);
  Object.defineProperties(m, {
    conn: {
      value: conn,
      enumerable: false,
    },
    raw: {
      value: raw,
      enumerable: false,
    },
  });
  if (!m.key) m.key = {};
  const k = m.key;
  const mode = k.addressingMode === 'pn' ? 'pn' : 'lid';
  const group = isGroupKey(k);
  const pickIdPair = (k, mode, group) => {
    if (k.fromMe)
      return {
        pn: conn?.user?.jid,
        lid: conn?.user?.lid,
      };
    if (group) {
      if (mode === 'pn')
        return {
          pn: k.participantAlt ?? k.participant,
          lid: k.participant ?? k.participantAlt,
        };
      return {
        lid: k.participant ?? k.participantAlt,
        pn: k.participantAlt ?? k.participant,
      };
    }
    if (mode === 'pn')
      return {
        pn: k.remoteJid ?? k.remoteJidAlt,
        lid: k.remoteJidAlt ?? k.remoteJid,
      };
    return {
      lid: k.remoteJid ?? k.remoteJidAlt,
      pn: k.remoteJidAlt ?? k.remoteJid,
    };
  };
  const pair = pickIdPair(k, mode, group);
  let pn = await ensureJid(coerceStr(pair.pn));
  let lid = await ensureLid(coerceStr(pair.lid));
  k.senderPn = decode(pn);
  k.senderLid = decode(lid);
  let qId = null;
  let qLid = null;
  if (m.quoted) {
    if (m.quoted.fromMe) {
      qId = conn?.user?.jid;
      qLid = conn?.user?.lid;
    } else {
      const p = getCtxInfo(m)?.participant;
      qId = await ensureJid(p);
      qLid = await ensureLid(p);
    }
  }
  k.quotedPn = decode(qId) || qId;
  k.quotedLid = decode(qLid) || qLid;
  if (m.msg?.contextInfo?.mentionedJid?.length > 0) {
    const rawMentions = m.msg.contextInfo.mentionedJid;
    const processedMentions = await Promise.all(
      rawMentions.map(async (jid) => await ensureJid(jid))
    );
    m.msg.contextInfo.mentionedJid = processedMentions.filter(Boolean);
  }
  let protocolMessageKey;
  if (m.message) {
    if (m.mtype === 'protocolMessage' && m.msg.key) {
      protocolMessageKey = m.msg.key;
      if (protocolMessageKey.remoteJid === 'status@broadcast')
        protocolMessageKey.remoteJid = m.chat;
      const selfId = decode(conn.user.id);
      const part = decode(protocolMessageKey.participant || '');
      protocolMessageKey.fromMe = part === selfId;
      if (!protocolMessageKey.fromMe && protocolMessageKey.remoteJid === selfId)
        protocolMessageKey.remoteJid = k.senderPn;
    }
    if (m.quoted && !m.quoted.mediaMessage) delete m.quoted.download;
  }
  if (!m.mediaMessage) delete m.download;
  if (typeof m.download !== 'function') {
    Object.defineProperty(m, 'download', {
      value(saveToFile = false) {
        const mt = this.mediaType;
        const mm = this.mediaMessage;
        if (!mt || !mm || !mm[mt]) return null;
        return this.conn?.downloadM(mm[mt], mt.replace(/message/i, ''), saveToFile);
      },
      enumerable: true,
      configurable: true,
    });
  }
  m.key = cleanObject({
    ...m.key,
  });
  try {
    if (protocolMessageKey && m.mtype === 'protocolMessage')
      conn.ev.emit('message.delete', protocolMessageKey);
  } catch {}
  return m;
}
let __serializedOnce = false;
export function serialize() {
  if (__serializedOnce) return;
  __serializedOnce = true;
  const MediaType = new Set([
    'imageMessage',
    'videoMessage',
    'audioMessage',
    'stickerMessage',
    'documentMessage',
  ]);
  return Object.defineProperties(proto.WebMessageInfo.prototype, {
    conn: {
      value: undefined,
      enumerable: false,
      writable: true,
    },
    id: {
      get() {
        return this.key?.id;
      },
    },
    isBaileys: {
      get() {
        return (
          this.id?.length === 16 || (this.id?.startsWith('3EB0') && this.id?.length === 12) || false
        );
      },
    },
    chat: {
      get() {
        const groupId = this.message?.senderKeyDistributionMessage?.groupId;
        const base = this.key?.remoteJid || (groupId && groupId !== 'status@broadcast') || '';
        let s = typeof base === 'string' ? base : '';
        return this.conn?.decodeJid?.(s) || s;
      },
      enumerable: true,
    },
    isGroup: {
      get() {
        return String(this.chat).endsWith('@g.us');
      },
      enumerable: true,
    },
    sender: {
      get() {
        return this.conn?.decodeJid?.(this.key.senderPn) || this.key.senderPn;
      },
      enumerable: true,
    },
    fromMe: {
      get() {
        return this.key?.fromMe || areJidsSameUser(this.conn?.user.id, this.sender) || false;
      },
    },
    mtype: {
      get() {
        if (!this.message) return '';
        const type = Object.keys(this.message);
        return (
          (!['senderKeyDistributionMessage', 'messageContextInfo'].includes(type[0]) && type[0]) ||
          (type.length >= 3 && type[1] !== 'messageContextInfo' && type[1]) ||
          type[type.length - 1]
        );
      },
      enumerable: true,
    },
    msg: {
      get() {
        if (!this.message) return null;
        return this.message[this.mtype];
      },
    },
    mediaMessage: {
      get() {
        if (!this.message) return null;
        if (this.mtype === 'interactiveMessage') {
          const header = this.msg?.header;
          if (header) {
            for (const mediaType of MediaType) {
              if (header[mediaType]) {
                return {
                  [mediaType]: header[mediaType],
                };
              }
            }
          }
        }
        const Message =
          (this.msg?.url || this.msg?.directPath
            ? {
                ...this.message,
              }
            : extractMessageContent(this.message)) || null;
        if (!Message) return null;
        const mtype = Object.keys(Message)[0];
        return MediaType.has(mtype) ? Message : null;
      },
      enumerable: true,
    },
    mediaType: {
      get() {
        let message;
        if (!(message = this.mediaMessage)) return null;
        return Object.keys(message)[0];
      },
      enumerable: true,
    },
    buttonResponse: {
      get() {
        if (this.mtype !== 'interactiveMessage') return null;
        const nativeFlow = this.msg?.nativeFlowResponseMessage;
        if (!nativeFlow) return null;
        try {
          const params = JSON.parse(nativeFlow.paramsJson || '{}');
          return {
            id: params.id,
            displayText: params.display_text || params.displayText,
            ...params,
          };
        } catch {
          return null;
        }
      },
      enumerable: true,
    },
    buttons: {
      get() {
        if (this.mtype !== 'interactiveMessage') return [];
        const buttons = this.msg?.nativeFlowMessage?.buttons || [];
        return buttons.map((btn) => {
          try {
            const params = JSON.parse(btn.buttonParamsJson || '{}');
            return {
              name: btn.name,
              displayText: params.display_text || params.displayText,
              id: params.id,
              ...params,
            };
          } catch {
            return {
              name: btn.name,
            };
          }
        });
      },
      enumerable: true,
    },
    header: {
      get() {
        if (this.mtype !== 'interactiveMessage') return null;
        return this.msg?.header || null;
      },
      enumerable: true,
    },
    footer: {
      get() {
        if (this.mtype !== 'interactiveMessage') return null;
        return this.msg?.footer?.text || null;
      },
      enumerable: true,
    },
    isInteractive: {
      get() {
        return this.mtype === 'interactiveMessage';
      },
      enumerable: true,
    },
    quoted: {
      get() {
        const self = this;
        const msg = self.msg;
        const ci = msg?.contextInfo;
        const qm = ci?.quotedMessage;
        if (!msg || !ci || !qm) return null;
        const type = Object.keys(qm)[0];
        let q = qm[type];
        const text = typeof q === 'string' ? q : q.text;
        const lidSenderPre = ci.participant || self.chat || '';
        const lidSender = lidSenderPre;
        const baseObj =
          typeof q === 'string'
            ? {
                text: q,
              }
            : q;
        const cloned = JSON.parse(JSON.stringify(baseObj));
        return Object.defineProperties(cloned, {
          mtype: {
            get() {
              return type;
            },
            enumerable: true,
          },
          mediaMessage: {
            get() {
              let _type;
              let Message;
              if (type == 'interactiveMessage') {
                _type = Object.keys(q.header || {})[0] || null;
                const hm = _type ? q.header[_type] : {};
                Message =
                  (hm?.url || hm?.directPath
                    ? {
                        [_type]: hm,
                      }
                    : extractMessageContent({
                        [_type]: hm,
                      })) || null;
              } else {
                Message =
                  (q?.url || q?.directPath
                    ? {
                        [type]: q,
                      }
                    : extractMessageContent({
                        [type]: q,
                      })) || null;
              }
              if (!Message) return null;
              const mt = Object.keys(Message)[0];
              return MediaType.has(mt) ? Message : null;
            },
            enumerable: true,
          },
          mediaType: {
            get() {
              let message;
              if (!(message = this.mediaMessage)) return null;
              return Object.keys(message)[0];
            },
            enumerable: true,
          },
          id: {
            get() {
              return ci.stanzaId;
            },
            enumerable: true,
          },
          chat: {
            get() {
              return ci.remoteJid || self.chat;
            },
            enumerable: true,
          },
          isBaileys: {
            get() {
              return (
                this.id?.length === 16 ||
                (this.id?.startsWith('3EB0') && this.id.length === 12) ||
                false
              );
            },
            enumerable: true,
          },
          sender: {
            get() {
              return self.key.quotedPn;
            },
            enumerable: true,
          },
          lidSender: {
            get() {
              return lidSender;
            },
            enumerable: true,
          },
          fromMe: {
            get() {
              return areJidsSameUser(this.sender, self.conn?.user.jid);
            },
            enumerable: true,
          },
          text: {
            get() {
              return text || this.caption || this.contentText || this.selectedDisplayText || '';
            },
            enumerable: true,
          },
          mentionedJid: {
            get() {
              const mentions =
                q?.contextInfo?.mentionedJid || self.getQuotedObj()?.mentionedJid || [];
              return mentions;
            },
            enumerable: true,
          },
          name: {
            get() {
              const s = this.sender;
              return s ? self.conn?.getName(s) : null;
            },
            enumerable: true,
          },
          vM: {
            get() {
              return proto.WebMessageInfo.create({
                key: {
                  fromMe: this.fromMe,
                  remoteJid: this.chat,
                  id: this.id,
                },
                message: {
                  [type]: q,
                },
                ...(self.isGroup
                  ? {
                      participant: this.sender,
                    }
                  : {}),
              });
            },
          },
          fakeObj: {
            get() {
              return this.vM;
            },
          },
          download: {
            value(saveToFile = false) {
              const mt = this.mediaType;
              const mm = this.mediaMessage;
              if (!mt || !mm || !mm[mt]) return null;
              return self.conn?.downloadM(mm[mt], mt.replace(/message/i, ''), saveToFile);
            },
            enumerable: true,
            configurable: true,
          },
          reply: {
            value(
              text,
              chatId,
              options = {},
              smlcap = {
                smlcap: true,
              }
            ) {
              return self.conn?.reply(chatId ? chatId : this.chat, text, this.vM, options, smlcap);
            },
            enumerable: true,
          },
          copy: {
            value() {
              const M = proto.WebMessageInfo;
              return smsg(self.conn, M.create(M.toObject(this.vM)));
            },
            enumerable: true,
          },
          forward: {
            value(jid, force = false, options) {
              return self.conn?.sendMessage(
                jid,
                {
                  forward: this.vM,
                  force,
                  ...options,
                },
                {
                  ...options,
                }
              );
            },
            enumerable: true,
          },
          copyNForward: {
            value(jid, forceForward = false, options = {}) {
              return self.conn?.copyNForward(jid, this.vM, forceForward, options);
            },
            enumerable: true,
          },
          cMod: {
            value(jid, text = '', sender = this.sender, options = {}) {
              return self.conn?.cMod(jid, this.vM, text, sender, options);
            },
            enumerable: true,
          },
          delete: {
            value() {
              return self.conn?.sendMessage(this.chat, {
                delete: this.vM.key,
              });
            },
            enumerable: true,
          },
        });
      },
      enumerable: true,
    },
    _text: {
      value: null,
      writable: true,
    },
    text: {
      get() {
        const msg = this.msg;
        if (this.mtype === 'interactiveMessage') {
          const bodyText = msg?.body?.text || '';
          const headerText = msg?.header?.title || '';
          const footerText = msg?.footer?.text || '';
          return bodyText || headerText;
        }
        const text =
          (typeof msg === 'string' ? msg : msg?.text) ||
          msg?.caption ||
          msg?.contentText ||
          msg?.selectedId ||
          msg?.nativeFlowResponseMessage ||
          '';
        return typeof this._text === 'string'
          ? this._text
          : (typeof text === 'string'
              ? text
              : text?.selectedDisplayText ||
                text?.hydratedTemplate?.hydratedContentText ||
                safeParseJson(text?.paramsJson)?.id ||
                text) || '';
      },
      set(str) {
        return (this._text = str);
      },
      enumerable: true,
    },
    mentionedJid: {
      get() {
        return this.msg?.contextInfo?.mentionedJid || [];
      },
      enumerable: true,
    },
    name: {
      get() {
        return (!nullish(this.pushName) && this.pushName) || this.conn?.getName(this.sender);
      },
      enumerable: true,
    },
    download: {
      value(saveToFile = false) {
        try {
          const mt = this.mediaType;
          const mm = this.mediaMessage;
          if (!mt || !mm || !mm[mt]) {
            console.log('No media found');
            return null;
          }
          const mediaObj = mm[mt];
          console.log('Downloading media:', mt, mediaObj);
          return this.conn?.downloadM(mediaObj, mt.replace(/message/i, ''), saveToFile);
        } catch (error) {
          console.error('Download error:', error);
          return null;
        }
      },
      enumerable: true,
      configurable: true,
    },
    reply: {
      value(
        text,
        chatId,
        options = {},
        smlcap = {
          smlcap: true,
        }
      ) {
        return this.conn?.reply(chatId ? chatId : this.chat, text, this, options, smlcap);
      },
    },
    copy: {
      value() {
        const M = proto.WebMessageInfo;
        return smsg(this.conn, M.create(M.toObject(this)));
      },
      enumerable: true,
    },
    forward: {
      value(jid, force = false, options = {}) {
        return this.conn?.sendMessage(
          jid,
          {
            forward: this,
            force,
            ...options,
          },
          {
            ...options,
          }
        );
      },
      enumerable: true,
    },
    copyNForward: {
      value(jid, forceForward = false, options = {}) {
        return this.conn?.copyNForward(jid, this, forceForward, options);
      },
      enumerable: true,
    },
    cMod: {
      value(jid, text = '', sender = this.sender, options = {}) {
        return this.conn?.cMod(jid, this, text, sender, options);
      },
      enumerable: true,
    },
    getQuotedObj: {
      value() {
        if (!this.quoted?.id) return null;
        const q = proto.WebMessageInfo.create(
          this.conn?.loadMessage(this.quoted.id) || this.quoted.vM
        );
        return smsg(this.conn, q);
      },
      enumerable: true,
    },
    getQuotedMessage: {
      get() {
        return this.getQuotedObj;
      },
    },
    delete: {
      value() {
        return this.conn?.sendMessage(this.chat, {
          delete: this.key,
        });
      },
      enumerable: true,
    },
    react: {
      value(emoji) {
        return this.conn?.sendMessage(this.chat, {
          react: {
            text: emoji,
            key: this.key,
          },
        });
      },
      enumerable: true,
    },
    caption: {
      get() {
        if (this.mtype === 'interactiveMessage') {
          return (
            this.msg?.header?.imageMessage?.caption ||
            this.msg?.header?.videoMessage?.caption ||
            this.msg?.header?.documentMessage?.caption ||
            ''
          );
        }
        return this.msg?.caption || '';
      },
      enumerable: true,
    },
    hasMedia: {
      get() {
        return this.mediaMessage !== null;
      },
      enumerable: true,
    },
    mediaInfo: {
      get() {
        if (!this.hasMedia) return null;
        const mt = this.mediaType;
        const mm = this.mediaMessage;
        const media = mm[mt];
        return {
          type: mt?.replace(/Message/i, ''),
          mimetype: media?.mimetype,
          size: media?.fileLength,
          url: media?.url,
          directPath: media?.directPath,
          mediaKey: media?.mediaKey,
          width: media?.width,
          height: media?.height,
          thumbnail: media?.jpegThumbnail,
          caption: this.caption,
        };
      },
      enumerable: true,
    },
  });
}
export function logic(check, inp, out) {
  if (inp.length !== out.length) throw new Error('Input and Output must have same length');
  for (let i in inp) if (util.isDeepStrictEqual(check, inp[i])) return out[i];
  return null;
}
export function protoType() {
  Buffer.prototype.toArrayBuffer = function toArrayBufferV2() {
    const ab = new ArrayBuffer(this.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < this.length; ++i) {
      view[i] = this[i];
    }
    return ab;
  };
  Buffer.prototype.toArrayBufferV2 = function toArrayBuffer() {
    return this.buffer.slice(this.byteOffset, this.byteOffset + this.byteLength);
  };
  ArrayBuffer.prototype.toBuffer = function toBuffer() {
    return Buffer.from(new Uint8Array(this));
  };
  Uint8Array.prototype.getFileType =
    ArrayBuffer.prototype.getFileType =
    Buffer.prototype.getFileType =
      async function getFileType() {
        return await fileTypeFromBuffer(this);
      };
  String.prototype.isNumber = Number.prototype.isNumber = isNumber;
  String.prototype.capitalize = function capitalize() {
    return this.charAt(0).toUpperCase() + this.slice(1, this.length);
  };
  String.prototype.capitalizeV2 = function capitalizeV2() {
    const str = this.split(' ');
    return str.map((v) => v.capitalize()).join(' ');
  };
  String.prototype.decodeJid = function decodeJid() {
    if (/:\d+@/gi.test(this)) {
      const decode = jidDecode(this) || {};
      return ((decode.user && decode.server && decode.user + '@' + decode.server) || this).trim();
    } else return this.trim();
  };
  Number.prototype.toTimeString = function toTimeString() {
    const seconds = Math.floor((this / 1000) % 60);
    const minutes = Math.floor((this / (60 * 1000)) % 60);
    const hours = Math.floor((this / (60 * 60 * 1000)) % 24);
    const days = Math.floor(this / (24 * 60 * 60 * 1000));
    return (
      (days ? `${days} day(s) ` : '') +
      (hours ? `${hours} hour(s) ` : '') +
      (minutes ? `${minutes} minute(s) ` : '') +
      (seconds ? `${seconds} second(s)` : '')
    ).trim();
  };
  Number.prototype.getRandom = String.prototype.getRandom = Array.prototype.getRandom = getRandom;
}
function isNumber() {
  const int = parseInt(this);
  return typeof int === 'number' && !isNaN(int);
}
function getRandom() {
  if (Array.isArray(this) || this instanceof String)
    return this[Math.floor(Math.random() * this.length)];
  return Math.floor(Math.random() * this);
}
function nullish(args) {
  return !(args !== null && args !== undefined);
}
export function makeWASocket(connectionOptions, options = {}) {
  let conn = _makeWaSocket(connectionOptions);
  const socketCtx = createSocketContext(conn, options);
  socketCtx.smsg = smsg;
  const sock = attachSocket(conn, socketCtx);
  if (config.bot?.bypassDisappearing) sock.bypassDisappearing?.(true);
  if (config.bot?.stealth) sock.stealth?.(true);
  if (sock.user?.id) sock.user.jid = sock.decodeJid(sock.user.id);
  store.bind(sock);
  return sock;
}
