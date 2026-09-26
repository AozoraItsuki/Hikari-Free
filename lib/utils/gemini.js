import { GoogleGenerativeAI } from '@google/generative-ai';

const keys = [
  'AIzaSyAOj381yoMxKvoPrrOsv0_oRmXLR-7m2SA',
  'AIzaSyAOzNevVWYqac09HPeL3AB-9yzj3GgaHSY',
  'AIzaSyAFvVU_EbS6eR-2AZvP_jX3DvnSGPVuYcM',
];
let cursor = Math.floor(Math.random() * keys.length);

export function createGemini() {
  const key = keys[cursor % keys.length];
  cursor += 1;
  return { genAI: new GoogleGenerativeAI(key), key };
}

export function isQuotaError(message = '') {
  return /429|quota|RESOURCE_EXHAUSTED|UNAVAILABLE|rate limit|too many requests/i.test(message);
}
