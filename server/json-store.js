import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(temp, file);
    fs.chmodSync(file, 0o600);
  } catch (error) {
    try {
      fs.unlinkSync(temp);
    } catch {
      // 临时文件可能尚未创建或已完成重命名。
    }
    throw error;
  }
}
