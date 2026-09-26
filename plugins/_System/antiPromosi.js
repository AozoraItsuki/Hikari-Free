import { detectPromotion } from '#lib/utils/helper';
import { db } from '#src/database';
const promotionKeywords = [
  'admin',
  'bank',
  'banting harga',
  'bayar di tempat',
  'beli',
  'beli 1 gratis 1',
  'berlaku hingga',
  'terbaik',
  'bit.ly',
  'bl.id',
  'bonus',
  'buruan',
  'cashback',
  'cepat',
  'cepat kaya',
  'check bio',
  'cicilan',
  'cod',
  'cs',
  'cuma-cuma',
  'cuci gudang',
  'cutt.ly',
  'daftar sekarang',
  'dana cepat',
  'dapatkan sekarang',
  'dijamin',
  'diskon',
  'dm',
  'download aplikasi',
  'dp',
  'fast response',
  'forex',
  'free',
  'free ongkir',
  'follow',
  'full body',
  'gacor',
  'garansi',
  'giveaway',
  'gratis',
  'gabung',
  'hadiah',
  'hanya hari ini',
  'harga',
  'harga miring',
  'harga promo',
  'harga khusus',
  'harga spesial',
  'hubungi',
  'idr',
  'info lebih lanjut',
  'inbox',
  'investasi',
  'japri',
  'jangan sampai ketinggalan',
  'join sekarang',
  'jual',
  'judi',
  'kesempatan terbatas',
  'klaim sekarang',
  'klik di sini',
  'klik link',
  'kontak kami',
  'limited',
  'link di bio',
  'maxwin',
  'murah',
  'no. 1',
  'obral',
  'ongkir gratis',
  'order',
  'pasti',
  'pembayaran',
  'pemesanan',
  'pesan sekarang',
  'pinjaman online',
  'pinjol',
  'potongan harga',
  'promo',
  'promo berakhir',
  'rahasia',
  'rebrand.ly',
  'rekening',
  'resmi',
  'rp',
  'rupiah',
  's.id',
  'sale',
  'sebelum kehabisan',
  'segera',
  'selengkapnya di',
  'shopee.link',
  'slot',
  'slot terbatas',
  'solusi',
  'stok terbatas',
  't.ly',
  'tanpa agunan',
  'tanpa dipungut biaya',
  'terbatas',
  'terbaik',
  'terbukti',
  'termurah',
  'tinyurl',
  'togel',
  'tokopedia.link',
  'trading',
  'transfer',
  'viral',
  'vcs',
  'wa',
  'wa.me',
  'whatsapp',
  'whatsapp.com',
  '100%',
];
function containsPromotionKeywords(text) {
  const lowerText = text.toLowerCase();
  for (const keyword of promotionKeywords) {
    if (lowerText.includes(keyword)) {
      return true;
    }
  }
  const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
  if (urlPattern.test(text)) {
    return true;
  }
  const phonePattern = /(\+?62|0)8\d{8,11}/g;
  if (phonePattern.test(text)) {
    return true;
  }
  return false;
}
export async function before(m, { isAdmin, isOwner, isBotAdmin }) {
  if (isAdmin || isOwner || m.fromMe) return;
  if (!db.data.chats[m.chat]?.antiPromosi) {
    return true;
  }
  try {
    const messageText = m.text || m.caption || '';
    if (!messageText || messageText.trim() === '') {
      return true;
    }
    const hasPromotionKeywords = containsPromotionKeywords(messageText);
    if (!hasPromotionKeywords) {
      return true;
    }
    const isPromotion = await detectPromotion(messageText);
    if (isPromotion) {
      if (isBotAdmin) {
        const teks =
          db.data.chats[m.chat].antiPromosiText ||
          'antiPromotion is active in this group, promotions are banned until an admin disables antiPromotion';
        await this.sendMessage(m.chat, {
          delete: m.key,
        });
        let quotedCustom = {
          key: {
            remoteJid: m.sender,
            fromMe: false,
            id: m.key.id,
          },
          message: {
            extendedTextMessage: {
              text: 'promotion service shut down on the spot 😹',
              matchedText: null,
              contextInfo: {
                mentionedJid: [m.sender],
              },
            },
          },
        };
        await this.sendMessage(
          m.chat,
          {
            text: teks,
          },
          {
            quoted: quotedCustom,
          }
        );
      } else {
        await this.sendMessage(
          m.chat,
          {
            text: 'antiPromotion is active in this group, but the bot is not an admin, so the bot cannot delete messages',
          },
          {
            quoted: m,
          }
        );
      }
      return false;
    } else {
    }
  } catch (error) {
    return true;
  }
  return true;
}
