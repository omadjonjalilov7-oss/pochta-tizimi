import { PDFDocument } from 'pdf-lib';

// Bir nechta PDF (Buffer) ni ketma-ket bitta PDF ga birlashtiradi.
// Buzuq yoki o'qib bo'lmaydigan PDF bo'lsa — o'sha qism tashlab ketiladi.
export async function mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
  const valid = buffers.filter((b) => b && b.length > 0);
  if (valid.length === 0) {
    throw new Error('mergePdfBuffers: birlashtirish uchun PDF yo\'q');
  }
  if (valid.length === 1) return valid[0];

  const out = await PDFDocument.create();
  for (const buf of valid) {
    try {
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } catch {
      /* bu PDF'ni birlashtirib bo'lmadi — o'tkazib yuboramiz */
    }
  }
  if (out.getPageCount() === 0) {
    // Hech biri o'qilmadi — birinchi buferni o'zini qaytaramiz.
    return valid[0];
  }
  const bytes = await out.save();
  return Buffer.from(bytes);
}
