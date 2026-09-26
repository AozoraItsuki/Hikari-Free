import { hkNet } from '#lib/utils/network';

let hikari = async (m, { conn, text, usedPrefix, command }) => {
  if (!text)
    return m.reply(
      `Usage: ${usedPrefix + command} <city>\nExample: ${usedPrefix + command} Jakarta`
    );
  const geo = await hkNet
    .get('https://geocoding-api.open-meteo.com/v1/search', {
      params: { name: text, count: 1, language: 'id' },
    })
    .then((r) => r.data?.results?.[0])
    .catch(() => null);
  if (!geo) return m.reply(`City not found: ${text}`);
  const w = await hkNet
    .get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: geo.latitude,
        longitude: geo.longitude,
        current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
        daily: 'temperature_2m_max,temperature_2m_min',
        timezone: 'auto',
      },
    })
    .then((r) => r.data)
    .catch(() => null);
  if (!w?.current) return m.reply('Failed to fetch weather data.');
  const codes = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Icy fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    80: 'Light showers',
    81: 'Showers',
    82: 'Heavy showers',
    95: 'Thunderstorm',
    96: 'Storm with hail',
    99: 'Storm with heavy hail',
  };
  const c = w.current;
  const d = w.daily;
  return m.reply(
    `🌤️ Weather: ${geo.name}, ${geo.country}\n🌡️ ${c.temperature_2m}°C (${codes[c.weather_code] ?? 'Unknown'})\n💧 Humidity: ${c.relative_humidity_2m}%\n💨 Wind: ${c.wind_speed_10m} km/h\n📈 Max: ${d.temperature_2m_max[0]}°C | 📉 Min: ${d.temperature_2m_min[0]}°C`
  );
};
hikari.help = ['cuaca'];
hikari.command = ['cuaca', 'weather'];
hikari.tags = ['internet'];
export default hikari;
