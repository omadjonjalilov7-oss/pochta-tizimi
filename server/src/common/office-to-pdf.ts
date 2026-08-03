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

// LibreOffice'ni bitta faylda ishga tushiradi. `workDir` ichida
// `<asos>.pdf` hosil bo'ladi.
function runLibreOffice(srcPath: string, workDir: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const profile = path.join(os.tmpdir(), `lo_profile_${randomUUID()}`);
    const args = [
      '--headless',
      '--norestore',
      '--nologo',
      '--nofirststartwizard',
      `-env:UserInstallation=file://${profile}`,
      '--convert-to',
      'pdf',
      '--outdir',
      workDir,
      srcPath,
    ];
    execFile(
      LO_BIN,
      args,
      { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        fs.rm(profile, { recursive: true, force: true }, () => {});
        if (err) {
          reject(new Error(`libreoffice_failed: ${err.message}`));
          return;
        }
        const base = path.basename(srcPath, path.extname(srcPath));
        const out = path.join(workDir, `${base}.pdf`);
        if (!fs.existsSync(out)) {
          reject(new Error(`pdf_not_created${stderr ? `: ${stderr}` : ''}`));
          return;
        }
        resolve(out);
      },
    );
  });
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
      const tmpPdf = await runLibreOffice(tmpSrc, workDir);
      await fsp.mkdir(path.dirname(destPdfPath), { recursive: true });
      await fsp.copyFile(tmpPdf, destPdfPath);
      return destPdfPath;
    } finally {
      await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  };

  const result = queue.then(run, run);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
