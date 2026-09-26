import axios from 'axios';
import config from '#config';
import { SocksProxyAgent } from 'socks-proxy-agent';

const normal = axios.create();
const tor = config.proxy?.useTor
  ? axios.create({
      httpAgent: new SocksProxyAgent('socks5h://127.0.0.1:' + config.proxy.port),
      httpsAgent: new SocksProxyAgent('socks5h://127.0.0.1:' + config.proxy.port),
      proxy: false,
    })
  : null;
const NO_TOR_HOSTS = ['files.catbox.moe'];
function hostFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
async function request(method, url, cfg = {}) {
  if (!config.proxy?.useTor || !tor) {
    return normal.request({
      method,
      url,
      timeout: 10000,
      ...cfg,
    });
  }
  const host = hostFromUrl(url);
  if (host && NO_TOR_HOSTS.includes(host)) {
    return normal.request({
      method,
      url,
      timeout: 10000,
      ...cfg,
    });
  }
  try {
    return await tor.request({
      method,
      url,
      timeout: 10000,
      ...cfg,
    });
  } catch {
    return normal.request({
      method,
      url,
      timeout: 10000,
      ...cfg,
    });
  }
}
async function hkNet(a, b) {
  if (typeof a === 'string') return request('GET', a, b || {});
  if (a && typeof a === 'object') {
    const { method = 'GET', url, data, ...rest } = a;
    return request(method.toUpperCase(), url, {
      data,
      ...rest,
    });
  }
  throw new Error('hkNet invalid args');
}
hkNet.get = (u, c) => request('GET', u, c || {});
hkNet.post = (u, d, c = {}) =>
  request('POST', u, {
    data: d,
    ...c,
  });
hkNet.put = (u, d, c = {}) =>
  request('PUT', u, {
    data: d,
    ...c,
  });
hkNet.delete = (u, c) => request('DELETE', u, c || {});
hkNet.request = (c) => request((c.method || 'GET').toUpperCase(), c.url, c);

export { hkNet, request };
