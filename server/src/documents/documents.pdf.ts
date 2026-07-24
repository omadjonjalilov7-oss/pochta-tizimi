import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

type AnyDoc = any;

const MARGIN = 30;
const PAGE_WIDTH = 595;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

// Kirill + lotin harflarni qo'llaydigan Unicode shrift.
// Ubuntu serverda tizim DejaVu shrifti bor; bo'lmasa Helvetica (faqat lotin).
const FONT_REGULAR_CANDIDATES = [
  path.join(process.cwd(), 'assets', 'fonts', 'DejaVuSans.ttf'),
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
];
const FONT_BOLD_CANDIDATES = [
  path.join(process.cwd(), 'assets', 'fonts', 'DejaVuSans-Bold.ttf'),
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
];

function firstExisting(candidates: string[]): string | null {
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function formatDateOnly(d: Date | string | null | undefined): string {
  if (!d) return '-';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()}`;
}

function getApprovers(participants: any[]): any[] {
  if (!Array.isArray(participants)) return [];
  return participants
    .filter(p => p.role === 'approver')
    .sort((a, b) => a.order - b.order);
}

function getExecutor(doc: any): any {
  if (!Array.isArray(doc.resolutions) || doc.resolutions.length === 0) return null;
  const resolution = doc.resolutions[0];
  if (!Array.isArray(resolution.targets) || resolution.targets.length === 0) return null;
  return resolution.targets[0];
}

function drawLine(pdf: PDFKit.PDFDocument, x1: number, y1: number, x2: number, y2: number) {
  pdf.moveTo(x1, y1).lineTo(x2, y2).lineWidth(0.8).strokeColor('#000').stroke();
}

function drawTableBox(
  pdf: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  colCount: number
) {
  const colWidth = width / colCount;

  // Vertikal chiziqlar
  for (let i = 0; i <= colCount; i++) {
    drawLine(pdf, x + i * colWidth, y, x + i * colWidth, y + height);
  }

  // Gorizontal chiziqlar
  drawLine(pdf, x, y, x + width, y);
  drawLine(pdf, x, y + height, x + width, y + height);
}

function drawVerticalLine(pdf: PDFKit.PDFDocument, x: number, y1: number, y2: number) {
  drawLine(pdf, x, y1, x, y2);
}

function drawHorizontalLine(pdf: PDFKit.PDFDocument, x1: number, x2: number, y: number) {
  drawLine(pdf, x1, y, x2, y);
}

export function buildDocumentPdf(doc: AnyDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const pdf = new PDFDocument({
        size: 'A4',
        margin: 0,
        info: {
          Title: doc.subject,
          Author: doc.createdBy?.fullName || 'Pochta EDO',
          Subject: doc.number,
          Producer: 'Pochta EDO',
        },
      });

      const chunks: Buffer[] = [];
      pdf.on('data', (c) => chunks.push(c as Buffer));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', reject);

      // Unicode shriftlarni ro'yxatdan o'tkazish (kirill matn buzilmasligi uchun)
      let FN = 'Helvetica';
      let FNB = 'Helvetica-Bold';
      const regularFont = firstExisting(FONT_REGULAR_CANDIDATES);
      const boldFont = firstExisting(FONT_BOLD_CANDIDATES);
      if (regularFont) {
        pdf.registerFont('DVS', regularFont);
        FN = 'DVS';
        FNB = 'DVS';
      }
      if (boldFont) {
        pdf.registerFont('DVS-Bold', boldFont);
        FNB = 'DVS-Bold';
      }
      pdf.font(FN);

      const approvers = getApprovers(doc.participants);
      const executor = getExecutor(doc);
      const pageHeight = pdf.page.height;
      const bottomMargin = 35;
      const tableBottom = pageHeight - bottomMargin;

      let y = MARGIN;
      const tableStartY = y;
      const tableX = MARGIN;
      const tableWidth = CONTENT_WIDTH;

      // ===== YAGONA JADVAL BOSHLASH - UNIFIED TABLE START =====
      const colCount = Math.max(3, Math.min(approvers.length + 1, 6));
      const colWidth = tableWidth / colCount;

      // Qator 1: Sarlavha (Header Row)
      const headerHeight = 18;
      const headers = ['Xizmat xati', 'Ijrochi', 'Mas\'ul', ...approvers.slice(2).map((_, i) => 'Xodim ' + (i + 3))];

      // Yuqori chiziq
      drawHorizontalLine(pdf, tableX, tableX + tableWidth, y);

      // Qator 1: Sarlavha (Header Row)
      const mergedHeight = headerHeight + 40; // Xizmat xati merged with detail row

      // Chap taraf: Xizmat xati (merged both rows) - oradagi chiziq yo'q
      drawVerticalLine(pdf, tableX + colWidth, y, y + mergedHeight);
      pdf.fontSize(7).fillColor('#000').font(FNB);
      // Markazida yozuv
      pdf.text('Xizmat xati', tableX + 2, y + (mergedHeight / 2 - 4), { width: colWidth - 4, align: 'center' });

      // Boshqa sarlavhalar - faqat birinchi qatorga
      for (let i = 1; i < colCount; i++) {
        drawVerticalLine(pdf, tableX + (i + 1) * colWidth, y, y + headerHeight);
        pdf.fontSize(7).fillColor('#000').font(FNB);
        pdf.text(headers[i] || '', tableX + i * colWidth + 2, y + 4, { width: colWidth - 4 });
      }
      drawVerticalLine(pdf, tableX + colCount * colWidth, y, y + headerHeight);
      // Gorizontal chiziq - faqat o'ng tarafda (Xizmat xati maydani bo'sh qolsin)
      drawHorizontalLine(pdf, tableX + colWidth, tableX + tableWidth, y + headerHeight);
      y += headerHeight;

      // Qator 2: Tasdiqlovchi ma'lumotlari (Approvers Details)
      const detailHeight = 40;
      for (let i = 1; i < colCount; i++) {
        let approver: any = null;
        if (i === 1) approver = approvers[0];
        else if (i === 2) approver = approvers[1];
        else if (i > 2) approver = approvers[i];

        const cellX = tableX + i * colWidth;
        pdf.fontSize(6).fillColor('#666').font(FN);
        pdf.text(approver?.user?.department?.name || '', cellX + 2, y + 2, { width: colWidth - 4 });
        pdf.text(approver?.user?.position?.name || '', cellX + 2, y + 10, { width: colWidth - 4 });
        pdf.fontSize(7).fillColor('#000').font(FNB);
        pdf.text(approver?.user?.fullName || '', cellX + 2, y + 18, { width: colWidth - 4 });

        drawVerticalLine(pdf, cellX + colWidth, y, y + detailHeight);
      }
      drawHorizontalLine(pdf, tableX, tableX + tableWidth, y + detailHeight);
      y += detailHeight;

      // Qator 3: Hujjat raqami va sanasi (Document Number and Date)
      const docInfoHeight = 20;
      drawVerticalLine(pdf, tableX + tableWidth / 2, y, y + docInfoHeight);
      pdf.fontSize(7).fillColor('#000').font(FN);
      pdf.text('Hujjat raqami: ' + doc.number, tableX + 5, y + 4, { width: tableWidth / 2 - 10 });
      pdf.text('Sana: ' + formatDateOnly(doc.createdAt), tableX + tableWidth / 2 + 5, y + 4, { width: tableWidth / 2 - 10 });
      drawVerticalLine(pdf, tableX + tableWidth, y, y + docInfoHeight);
      drawHorizontalLine(pdf, tableX, tableX + tableWidth, y + docInfoHeight);
      y += docInfoHeight;

      // Qator 4: Hujjat ochgan xodim (Document Creator)
      const creatorHeight = 20;
      const creatorColWidth = tableWidth / 3;
      drawVerticalLine(pdf, tableX + creatorColWidth, y, y + creatorHeight);
      drawVerticalLine(pdf, tableX + 2 * creatorColWidth, y, y + creatorHeight);
      pdf.fontSize(7).fillColor('#000').font(FN);
      pdf.text('Bo\'lim: ' + (doc.createdBy?.department?.name || '-'), tableX + 5, y + 4, { width: creatorColWidth - 10 });
      pdf.text('Lavozim: ' + (doc.createdBy?.position?.name || '-'), tableX + creatorColWidth + 5, y + 4, { width: creatorColWidth - 10 });
      pdf.text('Xodim: ' + (doc.createdBy?.fullName || '-'), tableX + 2 * creatorColWidth + 5, y + 4, { width: creatorColWidth - 10 });
      drawVerticalLine(pdf, tableX + tableWidth, y, y + creatorHeight);
      drawHorizontalLine(pdf, tableX, tableX + tableWidth, y + creatorHeight);
      y += creatorHeight;

      // Qator 5: Qabul qiluvchi (Executor/Receiver)
      const receiverHeight = 20;
      const receiverColWidth = tableWidth / 3;
      drawVerticalLine(pdf, tableX + receiverColWidth, y, y + receiverHeight);
      drawVerticalLine(pdf, tableX + 2 * receiverColWidth, y, y + receiverHeight);
      pdf.fontSize(7).fillColor('#000').font(FN);
      pdf.text('Bo\'lim: ' + (executor?.user?.department?.name || '-'), tableX + 5, y + 4, { width: receiverColWidth - 10 });
      pdf.text('Lavozim: ' + (executor?.user?.position?.name || '-'), tableX + receiverColWidth + 5, y + 4, { width: receiverColWidth - 10 });
      pdf.text('Xodim: ' + (executor?.user?.fullName || '-'), tableX + 2 * receiverColWidth + 5, y + 4, { width: receiverColWidth - 10 });
      drawVerticalLine(pdf, tableX + tableWidth, y, y + receiverHeight);
      drawHorizontalLine(pdf, tableX, tableX + tableWidth, y + receiverHeight);
      y += receiverHeight;

      // Qator 6: Bosh direktor tasdiqi (Director Approval)
      const directorHeight = 20;
      const directorColWidth = tableWidth / 3;
      drawVerticalLine(pdf, tableX + directorColWidth, y, y + directorHeight);
      drawVerticalLine(pdf, tableX + 2 * directorColWidth, y, y + directorHeight);
      pdf.fontSize(7).fillColor('#000').font(FN);
      pdf.text('Bosh direktor', tableX + 5, y + 4, { width: directorColWidth - 10 });
      pdf.text('Imzo: _____', tableX + directorColWidth + 5, y + 4, { width: directorColWidth - 10 });
      pdf.text('Sana: ' + formatDateOnly(new Date()), tableX + 2 * directorColWidth + 5, y + 4, { width: directorColWidth - 10 });
      drawVerticalLine(pdf, tableX + tableWidth, y, y + directorHeight);
      drawHorizontalLine(pdf, tableX, tableX + tableWidth, y + directorHeight);
      y += directorHeight;

      // Qator 7: Mavzu (Subject)
      const subjectHeight = 25;
      pdf.fontSize(7).fillColor('#000').font(FNB);
      pdf.text('Mavzu:', tableX + 5, y + 3, { width: tableWidth - 10 });
      pdf.font(FN);
      pdf.text(doc.subject, tableX + 5, y + 11, { width: tableWidth - 10 });
      drawVerticalLine(pdf, tableX, y, y + subjectHeight);
      drawVerticalLine(pdf, tableX + tableWidth, y, y + subjectHeight);
      drawHorizontalLine(pdf, tableX, tableX + tableWidth, y + subjectHeight);
      y += subjectHeight;

      // Qator 8: Hujjat matni (Document Body) - Expandable
      const bodyStartY = y;
      const bodyHeight = Math.max(100, tableBottom - y);

      pdf.fontSize(7).fillColor('#000').font(FNB);
      pdf.text('Hujjat matni:', tableX + 5, y + 3, { width: tableWidth - 10 });
      pdf.font(FN);
      pdf.fontSize(7);
      pdf.text(doc.body, tableX + 5, y + 11, { width: tableWidth - 10, lineGap: 1 });

      // Qator 8 oxiri - body section, bottom line before date row
      const bottomRowHeight = 20;
      const bottomRowY = tableBottom - bottomRowHeight;
      drawVerticalLine(pdf, tableX, bodyStartY, bottomRowY);
      drawVerticalLine(pdf, tableX + tableWidth, bodyStartY, bottomRowY);
      drawHorizontalLine(pdf, tableX, tableX + tableWidth, bottomRowY);

      // Qator 9: Ijro sanasi qatorı - 3 ta katak (2 bo'sh, 1 sana)
      const bottomCellWidth = tableWidth / 3;

      // Birinchi bo'sh katak
      drawVerticalLine(pdf, tableX + bottomCellWidth, bottomRowY, bottomRowY + bottomRowHeight);

      // Ikkinchi bo'sh katak
      drawVerticalLine(pdf, tableX + 2 * bottomCellWidth, bottomRowY, bottomRowY + bottomRowHeight);

      // Uchinchi katak - ijro sanasi
      pdf.fontSize(7).fillColor('#000').font(FN);
      pdf.text('Ijro sanasi:', tableX + 2 * bottomCellWidth + 2, bottomRowY + 2, { width: bottomCellWidth - 4 });
      pdf.text(formatDateOnly(new Date()), tableX + 2 * bottomCellWidth + 2, bottomRowY + 10, { width: bottomCellWidth - 4 });

      // Bottom o'ng chiziq
      drawVerticalLine(pdf, tableX + tableWidth, bottomRowY, bottomRowY + bottomRowHeight);

      // Pastgi chiziq
      drawHorizontalLine(pdf, tableX, tableX + tableWidth, bottomRowY + bottomRowHeight);

      // Chap chiziq - butun jadvalning chap qirrasi
      drawVerticalLine(pdf, tableX, tableStartY, bottomRowY + bottomRowHeight);

      // ===== JADVALDAN KEYIN FOOTER =====
      const footerStartY = bottomRowY + bottomRowHeight + 5;
      pdf.fontSize(7).fillColor('#000').font(FN);
      pdf.text('Ijrochi: ' + (executor?.user?.fullName || '-'), tableX, footerStartY);
      pdf.text('Telefon: ' + (executor?.user?.phone || '-'), tableX, footerStartY + 10);

      pdf.end();
    } catch (e) {
      reject(e);
    }
  });
}
