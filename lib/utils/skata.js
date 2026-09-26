import fs from 'fs';
import { PATH } from './helper.js';
import { pickRandom } from '#lib/utils/helper';
async function sKata() {
  return new Promise((resolve, reject) => {
    let kbbi = JSON.parse(fs.readFileSync(PATH.json + '/kbbi.json', 'utf-8'));
    let huruf = pickRandom([
      'a',
      'b',
      'c',
      'd',
      'e',
      'g',
      'h',
      'i',
      'j',
      'k',
      'l',
      'm',
      'n',
      'p',
      'r',
      's',
      't',
      'u',
      'w',
    ]);
    let res = kbbi.filter((v) => v.startsWith(huruf));
    resolve({
      status: true,
      kata: pickRandom(res),
    });
  });
}
async function cKata(input) {
  return new Promise((resolve, reject) => {
    let kbbi = JSON.parse(fs.readFileSync(PATH.json + '/kbbi.json', 'utf-8'));
    if (!kbbi.find((v) => v == input.toLowerCase()))
      return resolve({
        creator: '@neoxrs – Wildan Izzudin',
        status: false,
      });
    resolve({
      creator: '@neoxrs – Wildan Izzudin',
      status: true,
    });
  });
}
export { sKata, cKata };
