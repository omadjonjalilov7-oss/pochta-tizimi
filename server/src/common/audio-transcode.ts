import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

// Ovozli xabarlarni iPhone (Safari) ham o'ynaydigan formatga o'girish.
//   - Android/Chrome `webm/opus` yozadi — iPhone uni O'YNATA olmaydi.
//   - Shu sabab serverda ffmpeg orqali `m4a` (MP4/AAC)ga o'giramiz — bu
//     format barcha platformalarda (iPhone, Android, desktop) ishlaydi.
//   - ffmpeg o'rnatilmagan yoki xato bersa — null qaytadi, chaqiruvchi esa
//     asl faylni saqlaydi (hech bo'lmasa Android'da ishlaydi).
//   - ffmpeg yo'li: FFMPEG_PATH env, bo'lmasa tizimdagi `ffmpeg`.

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFMPEG_TIMEOUT_MS = 30_000;

// Shu audio turini m4a'ga o'girish kerakmi? Allaqachon mp4/aac/mp3 bo'lsa —
// tegmaymiz (ular baribir hamma joyda ishlaydi).
export function isTranscodableAudio(mime: string, ext: string): boolean {
  const m = (mime || '').toLowerCase();
  const e = (ext || '').toLowerCase();
  if (
    m.includes('mp4') ||
    m.includes('aac') ||
    m.includes('mpeg') || // audio/mpeg = mp3
    e === '.m4a' ||
    e === '.mp3' ||
    e === '.aac' ||
    e === '.wav'
  ) {
    return false;
  }
  return (
    m.startsWith('audio/') ||
    e === '.webm' ||
    e === '.ogg' ||
    e === '.opus'
  );
}

// Buferni m4a (AAC) ga o'giradi. Muvaffaqiyatli bo'lsa yangi buferni, aks holda
// null qaytaradi (chaqiruvchi asl faylga qaytadi).
export async function transcodeAudioToM4a(
  input: Buffer,
  srcExt: string,
): Promise<Buffer | null> {
  const tmp = os.tmpdir();
  const base = randomUUID();
  const inPath = path.join(tmp, `${base}${srcExt || '.webm'}`);
  const outPath = path.join(tmp, `${base}.m4a`);
  try {
    await fs.writeFile(inPath, input);
    await runFfmpeg([
      '-y',
      '-i',
      inPath,
      '-vn', // video yo'q
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-movflags',
      '+faststart', // tez boshlanishi uchun moov atomini oldinga
      outPath,
    ]);
    const out = await fs.readFile(outPath);
    return out && out.length > 0 ? out : null;
  } catch {
    return null;
  } finally {
    fs.unlink(inPath).catch(() => undefined);
    fs.unlink(outPath).catch(() => undefined);
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const proc = spawn(FFMPEG, args, {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill('SIGKILL');
        reject(new Error('ffmpeg timeout'));
      }
    }, FFMPEG_TIMEOUT_MS);
    proc.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(e);
    });
    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}`));
    });
  });
}
