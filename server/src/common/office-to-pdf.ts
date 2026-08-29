import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

// LibreOffice ijro fayli. Ubuntu'da odatda `libreoffice` yoki `soffice`.
// Kerak bo'lsa .env orqali LIBREOFFICE_BIN bilan almashtiriladi.
const LO_BIN = process.env.LIBREOFFICE_BIN || 'libreoffice';

// Bir vaqtda ko'p konvertatsiya bo'lganда navbat (LibreOffice bir vaqtda
// ko'p ishga tushmasligi uchun oddiy ketma-ket navbat).
let queue: Promise<unknown> = Promise.resolve();

// LibreOffice'ni bitta faylда ishga tushiradi. `convertTo` — LibreOffice
// `--convert-to` argumenti (masalan 'pdf', 'html:HTML (StarWriter)',
// 'docx:MS Word 2007 XML'). `outExt` — hosil bo'ladigan fayl kengaytmasi
// (masalan 'pdf', 'html', 'docx'). `workDir` ichida `<asos>.<outExt>` hosil
// bo'ladi va uning yo'li qaytariladi.
function runLibreOffice(
  srcPath: string,
  workDir: string,
  convertTo: string,
  outExt: string,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const profile = path.join(os.tmpdir(), `lo_profile_${randomUUID()}`);
    const args = [
      '--headless',
      '--norestore',
      '--nologo',
      '--nofirststartwizard',
      `-env:UserInstallation=file://${profile}`,
      '--convert-to',
      convertTo,
      '--outdir',
      workDir,
      srcPath,
    ];
    execFile(
      LO_BIN,
      args,
      { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        fs.rm(profile, { recursive: true, force: true }, () => {});
        if (err) {
          reject(new Error(`libreoffice_failed: ${err.message}`));
          return;
        }
        const base = path.basename(srcPath, path.extname(srcPath));
        const out = path.join(workDir, `${base}.${outExt}`);
        if (!fs.existsSync(out)) {
          reject(new Error(`convert_failed${stderr ? `: ${stderr}` : ''}`));
          return;
        }
        resolve(out);
      },
    );
  });
}

// Navbatga qo'yib, funksiyani ketma-ket bajaradi.
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn, fn);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

// Office (Word/Excel/PowerPoint) faylni PDF ga aylantirib, `destPdfPath` ga
// yozadi. Manba fayl avval TOZA vaqtinchalik papkaga (/tmp) nusxalanadi —
// shu tufayli manba yo'lida g'alati belgilar (masalan Windows-uslub backslash)
// bo'lsa ham LibreOffice muammosiz o'qiydi.
export function convertOfficeToPdf(
  srcPath: string,
  destPdfPath: string,
): Promise<string> {
  const run = async (): Promise<string> => {
    const ext = path.extname(srcPath) || '.tmp';
    const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'office2pdf_'));
    const tmpSrc = path.join(workDir, `source${ext}`);
    try {
      await fsp.copyFile(srcPath, tmpSrc);
      const tmpPdf = await runLibreOffice(tmpSrc, workDir, 'pdf', 'pdf');
      await fsp.mkdir(path.dirname(destPdfPath), { recursive: true });
      await fsp.copyFile(tmpPdf, destPdfPath);
      return destPdfPath;
    } finally {
      await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  };
  return enqueue(run);
}

// HTML ichidagi `src="data:image/...;base64,..."` rasmlarni vaqtinchalik
// fayllarga (workDir ichida) chiqarib, HTML'da ularga fayl nomi bilan murojaat
// qiladi. LibreOffice HTML importda data-URI rasmlarni ba'zan tashlab ketadi
// (masalan QR kod yo'qoladi), fayl yo'li bilan esa ishonchli o'qiydi.
async function externalizeDataUriImages(
  html: string,
  workDir: string,
): Promise<string> {
  const re = /src\s*=\s*(["'])(data:(image\/[a-z0-9.+-]+);base64,([^"']+))\1/gi;
  const matches = [...html.matchAll(re)];
  let out = html;
  let idx = 0;
  for (const m of matches) {
    const mime = m[3].toLowerCase();
    const b64 = m[4];
    const ext =
      mime === 'image/jpeg'
        ? 'jpg'
        : mime === 'image/gif'
          ? 'gif'
          : mime === 'image/bmp'
            ? 'bmp'
            : mime === 'image/webp'
              ? 'webp'
              : 'png';
    const name = `imgdata_${idx++}.${ext}`;
    try {
      await fsp.writeFile(path.join(workDir, name), Buffer.from(b64, 'base64'));
      // Butun data-URI matnini fayl nomiga almashtiramiz (literal split/join).
      out = out.split(m[2]).join(name);
    } catch {
      /* rasmni yoza olmadik — data-URI'ni qoldiramiz */
    }
  }
  return out;
}

// HTML matnni (masalan to'ldirilgan shablon yoki hujjat kartasi) PDF ga
// aylantirib, `destPath` ga yozadi. data-URI rasmlar (QR) avval fayllarga
// chiqariladi. LibreOffice orqali render qilinadi — brauzer chop oynasidagi
// ko'rinishga yaqin natija beradi.
export function convertHtmlToPdf(
  html: string,
  destPath: string,
): Promise<string> {
  const run = async (): Promise<string> => {
    const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'html2pdf_'));
    const tmpSrc = path.join(workDir, 'source.html');
    try {
      const externalized = await externalizeDataUriImages(html, workDir);
      const full = /<html[\s>]/i.test(externalized)
        ? externalized
        : `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${externalized}</body></html>`;
      await fsp.writeFile(tmpSrc, full, 'utf8');
      const tmpPdf = await runLibreOffice(tmpSrc, workDir, 'pdf', 'pdf');
      await fsp.mkdir(path.dirname(destPath), { recursive: true });
      await fsp.copyFile(tmpPdf, destPath);
      return destPath;
    } finally {
      await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  };
  return enqueue(run);
}

// Rasm kengaytmasi → MIME turi (HTML ichiga data-URI qilib joylash uchun).
const IMG_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

// LibreOffice HTML eksportда rasmlarни alohida fayllarга (masalan
// source_html_1.png) yozadi va ularga `src="..."` bilan murojaat qiladi.
// Brauzerда ko'rsatish uchun barcha rasmlarни o'qib, data-URI qilib HTML
// ichiga joylaymiz — natijaда bitta o'zini-o'zi ta'minlaydigan HTML bo'ladi.
async function inlineHtmlImages(html: string, workDir: string): Promise<string> {
  const srcRe = /src\s*=\s*(["'])(.*?)\1/gi;
  const matches = [...html.matchAll(srcRe)];
  let out = html;
  for (const m of matches) {
    const ref = m[2];
    if (/^data:/i.test(ref) || /^https?:/i.test(ref)) continue;
    const decoded = decodeURIComponent(ref);
    const imgPath = path.join(workDir, path.basename(decoded));
    try {
      const buf = await fsp.readFile(imgPath);
      const mime = IMG_MIME[path.extname(imgPath).toLowerCase()] || 'image/png';
      const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
      out = out.split(m[0]).join(`src="${dataUri}"`);
    } catch {
      /* rasm topilmadi — o'zini qoldiramiz */
    }
  }
  return out;
}

// Faqat <body> ichini ajratib oladi (butun HTML hujjat o'rniga tahrirlash
// uchun asosiy matnни).
function extractBody(html: string): string {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1] : html;
}

// Word/ODT/RTF faylни tahrirlash uchun HTML matnга aylantiradi. Rasmlar
// data-URI qilib ichига joylanadi. Faqat <body> ichи qaytariladi.
export function convertDocToHtml(srcPath: string): Promise<string> {
  const run = async (): Promise<string> => {
    const ext = path.extname(srcPath) || '.docx';
    const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'doc2html_'));
    const tmpSrc = path.join(workDir, `source${ext}`);
    try {
      await fsp.copyFile(srcPath, tmpSrc);
      const tmpHtml = await runLibreOffice(
        tmpSrc,
        workDir,
        'html:HTML (StarWriter)',
        'html',
      );
      const raw = await fsp.readFile(tmpHtml, 'utf8');
      const inlined = await inlineHtmlImages(raw, workDir);
      return extractBody(inlined);
    } finally {
      await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  };
  return enqueue(run);
}

// Fayl kengaytmasига mos LibreOffice eksport filtri.
function docConvertTarget(ext: string): { convertTo: string; outExt: string } {
  const e = ext.toLowerCase().replace(/^\./, '');
  switch (e) {
    case 'doc':
      return { convertTo: 'doc:MS Word 97', outExt: 'doc' };
    case 'rtf':
      return { convertTo: 'rtf:Rich Text Format', outExt: 'rtf' };
    case 'odt':
      return { convertTo: 'odt:writer8', outExt: 'odt' };
    case 'docx':
    default:
      return { convertTo: 'docx:MS Word 2007 XML', outExt: 'docx' };
  }
}

// Tahrirlangan HTML matnни yana Office faylига (asl kengaytмада) aylantirib,
// `destPath` ga yozadi. Rasmlar data-URI ko'rinishда bo'lса LibreOffice ularни
// import qiladi.
export function convertHtmlToDoc(
  html: string,
  destPath: string,
): Promise<string> {
  const run = async (): Promise<string> => {
    const ext = path.extname(destPath) || '.docx';
    const { convertTo, outExt } = docConvertTarget(ext);
    const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'html2doc_'));
    const tmpSrc = path.join(workDir, 'source.html');
    try {
      const full = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
      await fsp.writeFile(tmpSrc, full, 'utf8');
      const tmpOut = await runLibreOffice(tmpSrc, workDir, convertTo, outExt);
      await fsp.mkdir(path.dirname(destPath), { recursive: true });
      await fsp.copyFile(tmpOut, destPath);
      return destPath;
    } finally {
      await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  };
  return enqueue(run);
}
