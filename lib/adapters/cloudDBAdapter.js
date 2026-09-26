import { hkNet } from '../utils/network.js';
const stringify = (obj) => JSON.stringify(obj, null, 2);
const parse = (str) =>
  JSON.parse(str, (_, v) => {
    if (
      v !== null &&
      typeof v === 'object' &&
      'type' in v &&
      v.type === 'Buffer' &&
      'data' in v &&
      Array.isArray(v.data)
    ) {
      return Buffer.from(v.data);
    }
    return v;
  });
export class CloudDBAdapter {
  constructor(url, { serialize = stringify, deserialize = parse, fetchOptions = {} } = {}) {
    this.url = url;
    this.serialize = serialize;
    this.deserialize = deserialize;
    this.fetchOptions = fetchOptions;
  }
  async read() {
    try {
      let res = await hkNet.get(this.url, {
        headers: {
          Accept: 'application/json;q=0.9,text/plain',
        },
        ...this.fetchOptions,
      });
      return this.deserialize(res.data);
    } catch (e) {
      return null;
    }
  }
  async write(obj) {
    let res = await hkNet.post(this.url, this.serialize(obj), {
      headers: {
        'Content-Type': 'application/json',
      },
      ...this.fetchOptions,
    });
    return res.data;
  }
}
