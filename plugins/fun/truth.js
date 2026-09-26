import { hkNet } from '#lib/utils/network';
let hikari = async (m, { conn, usedPrefix }) => {
  try {
    let result = await hkNet.get(
      'https://raw.githubusercontent.com/BochilTeam/database/master/kata-kata/truth.json'
    );
    let truth = result.data[Math.floor(Math.random() * result.data.length)];
    m.reply(truth);
  } catch (e) {
    m.reply('Failed to fetch truth data.');
  }
};
hikari.help = ['truth'];
hikari.command = /^(truth)$/i;
export default hikari;
