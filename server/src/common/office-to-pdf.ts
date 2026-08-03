import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// LibreOffice ijro fayli. Ubuntu'da odatda `libreoffice` yoki `soffice`.
// Kerak bo'lsa .env orqali LIBREOFFICE_BIN bilan almashtiriladi.
const LO_BIN = process.env.LIBREOFFICE_BIN || 'libreoffice';

// Bir vaqtda ko'p konvertatsiya bo'lganда navbat (LibreOffice bitta profil
// bilan parallel ishlay olmaydi — har biriga alohida profil beramiz, lekin
// bir vaqtda 2 ta ishga tushmasligi uchun oddiy navbat).
let queue: Promise<unknown> = Promise.resolve();

// Office (Word/Excel/PowerPoint va h.k.) faylni PDF ga aylantiradi.
// Natijadagi PDF yo'lini qaytaradi. `outDir` ichida `<asos>.pdf` hosil bo'ladi.
export function convertOfficeToPdf(
  srcPath: string,
  outDir: string,
): Promise<string> {
  const run = () =>
    new Promise<string>((resolve, reject) => {
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
        outDir,
        srcPath,
      ];
      execFile(
        LO_BIN,
        args,
        { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
        (err, _stdout, stderr) => {
          // Vaqtinchalik profil papkasini tozalaymiz.
          fs.rm(profile, { recursive: true, force: true }, () => {});
          if (err) {
            reject(
              new Error(
                `libreoffice_failed: ${err.message}${
                  stderr ? ` | ${stderr}` : ''
                }`,
              ),
            );
            return;
          }
          const base = path.basename(srcPath, path.extname(srcPath));
          const out = path.join(outDir, `${base}.pdf`);
          if (!fs.existsSync(out)) {
            reject(new Error(`pdf_not_created${stderr ? `: ${stderr}` : ''}`));
            return;
          }
          resolve(out);
        },
      );
    });

  // Navbatga qo'shamiz (ketma-ket bajariladi).
  const result = queue.then(run, run);
  // Navbat zanjiri uzilib qolmasligi uchun xatoni yutamiz.
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
