import { hkNet } from '#lib/utils/network';

export async function welcomeBanner(avatar, name, subject, type) {
  const baseUrl = 'https://api.popcat.xyz/welcomecard';
  const background = 'https://cdn.popcat.xyz/welcome-bg.png';
  const text1 = name;
  const text2 = type === 'welcome' ? `Welcome To ${subject}` : `Goodbye From ${subject}`;
  const text3 = type === 'welcome' ? 'Glad to have you here!' : "We'll miss you!";
  const url = `${baseUrl}?background=${encodeURIComponent(background)}&text1=${encodeURIComponent(text1)}&text2=${encodeURIComponent(text2)}&text3=${encodeURIComponent(text3)}&avatar=${encodeURIComponent(avatar)}`;
  try {
    const response = await hkNet.get(url, {
      responseType: 'arraybuffer',
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Error creating welcome banner:', error);
    return null;
  }
}
