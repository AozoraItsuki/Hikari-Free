import zlib from 'zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function computeCrc32(buffer) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buffer) >>> 0;
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const signature = (bytes) => Buffer.from(bytes, 'hex');

function localFileHeader(nameBuffer, crc, size, method) {
  const header = Buffer.alloc(30);
  signature('504b0304').copy(header, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(method, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0x21, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(nameBuffer.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function centralDirectoryEntry(nameBuffer, crc, size, method, localOffset) {
  const entry = Buffer.alloc(46);
  signature('504b0102').copy(entry, 0);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0, 8);
  entry.writeUInt16LE(method, 10);
  entry.writeUInt16LE(0, 12);
  entry.writeUInt16LE(0x21, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(size, 20);
  entry.writeUInt32LE(size, 24);
  entry.writeUInt16LE(nameBuffer.length, 28);
  entry.writeUInt16LE(0, 30);
  entry.writeUInt16LE(0, 32);
  entry.writeUInt16LE(0, 34);
  entry.writeUInt16LE(0, 36);
  entry.writeUInt32LE(0, 38);
  entry.writeUInt32LE(localOffset, 42);
  return entry;
}

function endOfCentralDirectory(entries, size, offset) {
  const record = Buffer.alloc(22);
  signature('504b0506').copy(record, 0);
  record.writeUInt16LE(entries, 8);
  record.writeUInt16LE(entries, 10);
  record.writeUInt32LE(size, 12);
  record.writeUInt32LE(offset, 16);
  record.writeUInt16LE(0, 20);
  return record;
}

export function createZip(files = []) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new TypeError('createZip requires at least one file entry');
  }
  const parts = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    if (!file || typeof file.name !== 'string' || !Buffer.isBuffer(file.data)) {
      throw new TypeError('each zip entry needs { name: string, data: Buffer }');
    }
    const nameBuffer = Buffer.from(file.name, 'utf8');
    const compressed = zlib.deflateRawSync(file.data);
    const crc = computeCrc32(file.data);
    const size = compressed.length;
    const localOffset = offset;
    const header = localFileHeader(nameBuffer, crc, size, 8);
    parts.push(header, nameBuffer, compressed);
    offset += header.length + nameBuffer.length + size;
    const entry = centralDirectoryEntry(nameBuffer, crc, size, 8, localOffset);
    central.push(entry, nameBuffer);
  }
  const directory = Buffer.concat(central);
  const end = endOfCentralDirectory(files.length, directory.length, offset);
  return Buffer.concat([...parts, directory, end]);
}
