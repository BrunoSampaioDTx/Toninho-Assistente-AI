// Packages dist/ into release/<name>-v<version>.zip for sharing (Load unpacked or store upload).
// Dependency-free ZIP writer: deflate via node:zlib, no ZIP64 (fine for extension-sized archives).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const distDir = path.join(root, 'dist');
const { name, version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const outFile = path.join(root, 'release', `${name}-v${version}.zip`);

if (!fs.existsSync(path.join(distDir, 'manifest.json'))) {
  console.error('dist/manifest.json not found. Run "npm run build" first.');
  process.exit(1);
}
if (fs.existsSync(outFile)) {
  console.error(`${path.relative(root, outFile)} already exists. Bump "version" in package.json or delete the file.`);
  process.exit(1);
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

const UTF8_FLAG = 0x0800;
const DEFLATE = 8;
const localParts = [];
const centralParts = [];
let offset = 0;

for (const file of listFiles(distDir)) {
  const entryName = Buffer.from(path.relative(distDir, file).split(path.sep).join('/'), 'utf8');
  const data = fs.readFileSync(file);
  const compressed = zlib.deflateRawSync(data, { level: 9 });
  const crc = zlib.crc32(data);
  const { time, day } = dosDateTime(fs.statSync(file).mtime);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(UTF8_FLAG, 6);
  local.writeUInt16LE(DEFLATE, 8);
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(day, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(entryName.length, 26);
  local.writeUInt16LE(0, 28); // extra length

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed
  central.writeUInt16LE(UTF8_FLAG, 8);
  central.writeUInt16LE(DEFLATE, 10);
  central.writeUInt16LE(time, 12);
  central.writeUInt16LE(day, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(entryName.length, 28);
  // extra, comment, disk, internal/external attributes stay 0
  central.writeUInt32LE(offset, 42);

  localParts.push(local, entryName, compressed);
  centralParts.push(central, entryName);
  offset += local.length + entryName.length + compressed.length;
}

const centralDir = Buffer.concat(centralParts);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(centralParts.length / 2, 8);
end.writeUInt16LE(centralParts.length / 2, 10);
end.writeUInt32LE(centralDir.length, 12);
end.writeUInt32LE(offset, 16);

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, Buffer.concat([...localParts, centralDir, end]), { flag: 'wx' });
console.log(`Created ${path.relative(root, outFile)} (${centralParts.length / 2} files, ${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`);
