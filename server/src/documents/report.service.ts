import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// ── Yorliqlar ─────────────────────────────────────────────────────────────
// Rasmdagi (Excel) hisobotga mos ravishda hujjat turlari Kirill alifbosida.
const TYPE_LABELS: Record<string, string> = {
  internal: 'Ички ҳужжат',
  incoming: 'Кирувчи ҳужжат',
  outgoing: 'Чиқувчи ҳужжат',
};

// Kelishuv turi (Келишиш тури) — izohsiz tasdiqlangan bo'lsa "o'zgarishlarsiz",
// biror tasdiqlovchi izoh qoldirsa "o'zgartirishlar bilan".
const AGREEMENT_NO_CHANGE = 'Ўзгаришларсиз келишиш';
const AGREEMENT_WITH_CHANGE = 'Ўзгартиришлар билан келишиш';

interface ReportRow {
  id: string;
  index: number;
  number: string;
  createdAt: Date;
  createdBy: string;
  type: string;
  typeRaw: string;
  subject: string;
  agreedDate: Date | null;
  approvers: string;
  agreementType: string;
}

export interface ReportPreviewRow {
  id: string;
  index: number;
  number: string;
  createdAt: string;
  createdBy: string;
  type: string;
  typeRaw: string;
  subject: string;
  agreedDate: string | null;
  approvers: string;
  agreementType: string;
}

export interface ReportPreviewResult {
  from: string;
  to: string;
  total: number;
  rows: ReportPreviewRow[];
}

const COLUMNS: { header: string; width: number; key: keyof ReportRow }[] = [
  { header: '№', width: 6, key: 'index' },
  { header: 'Ҳужжат рақами', width: 16, key: 'number' },
  { header: 'Киритилган санаси', width: 15, key: 'createdAt' },
  { header: 'Ким томонидан киритилган', width: 26, key: 'createdBy' },
  { header: 'Ҳужжат тури', width: 16, key: 'type' },
  { header: 'Ҳужжатнинг қисқача мазмуни', width: 44, key: 'subject' },
  { header: 'Келишилган санаси', width: 15, key: 'agreedDate' },
  { header: 'Келишган ходим исм, фамилияси', width: 28, key: 'approvers' },
  { header: 'Келишиш тури', width: 22, key: 'agreementType' },
];

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '-';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()}`;
}

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  private async fetchRows(
    userId: string,
    canSeeAll: boolean,
    from: Date,
    to: Date,
    type?: string,
    search?: string,
  ): Promise<ReportRow[]> {
    const where: Prisma.DocumentWhereInput = {
      createdAt: { gte: from, lte: to },
      status: { not: 'draft' },
    };
    if (type && ['internal', 'incoming', 'outgoing'].includes(type)) {
      where.type = type as Prisma.DocumentWhereInput['type'];
    }
    if (!canSeeAll) {
      where.OR = [
        { createdById: userId },
        { participants: { some: { userId } } },
      ];
    }
    // Ixtiyoriy qidiruv — raqam, mavzu, muallif F.I.Sh yoki bo'lim nomi bo'yicha.
    const q = search?.trim();
    if (q) {
      const like = { contains: q, mode: 'insensitive' as const };
      where.AND = [
        {
          OR: [
            { number: like },
            { subject: like },
            { createdBy: { fullName: like } },
            { createdBy: { department: { name: like } } },
          ],
        },
      ];
    }

    const docs = await this.prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        subject: true,
        type: true,
        status: true,
        createdAt: true,
        closedAt: true,
        createdBy: {
          select: { fullName: true, department: { select: { name: true } } },
        },
        participants: {
          where: { role: 'approver' },
          orderBy: { order: 'asc' },
          select: {
            status: true,
            actedAt: true,
            approvalNotes: true,
            user: { select: { fullName: true } },
          },
        },
      },
    });

    return docs.map((d, i) => {
      // Faqat tasdiqlagan (approved/done) kelishuvchilar hisobga olinadi.
      const approved = d.participants.filter(
        (p) => p.status === 'approved' || p.status === 'done',
      );
      const approvers = approved
        .map((p) => p.user?.fullName)
        .filter((n): n is string => !!n)
        .join(', ');
      // Kelishilgan sana — eng oxirgi tasdiq sanasi, bo'lmasa hujjat yopilgan sana.
      const actedDates = approved
        .map((p) => p.actedAt)
        .filter((x): x is Date => !!x);
      const agreedDate = actedDates.length
        ? new Date(Math.max(...actedDates.map((x) => x.getTime())))
        : (d.closedAt ?? null);
      // Kelishuv turi — biror tasdiqlovchi izoh qoldirgan bo'lsa "o'zgartirishlar bilan".
      const hasNotes = approved.some((p) => !!p.approvalNotes?.trim());
      const agreementType =
        approved.length === 0
          ? '-'
          : hasNotes
            ? AGREEMENT_WITH_CHANGE
            : AGREEMENT_NO_CHANGE;

      return {
        id: d.id,
        index: i + 1,
        number: d.number,
        createdAt: d.createdAt,
        createdBy: d.createdBy?.fullName ?? '-',
        type: TYPE_LABELS[d.type] ?? d.type,
        typeRaw: d.type,
        subject: d.subject,
        agreedDate,
        approvers: approvers || '-',
        agreementType,
      };
    });
  }

  private cell(row: ReportRow, key: keyof ReportRow): string {
    const v = row[key];
    if (key === 'createdAt' || key === 'agreedDate') return fmtDate(v as Date | null);
    return v == null ? '-' : String(v);
  }

  // ── Excel ────────────────────────────────────────────────────────────────
  private async buildExcel(rows: ReportRow[], from: Date, to: Date): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Asaka Motors EDO';
    wb.created = new Date();
    const ws = wb.addWorksheet('Hisobot');

    // Sarlavha satri
    ws.mergeCells(1, 1, 1, COLUMNS.length);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = `Ҳужжатлар ҳисоботи  (${fmtDate(from)} — ${fmtDate(to)})`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };
    ws.getRow(1).height = 22;

    // Ustun sarlavhalari
    const headerRow = ws.getRow(2);
    COLUMNS.forEach((col, idx) => {
      const c = headerRow.getCell(idx + 1);
      c.value = col.header;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5821F' } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      ws.getColumn(idx + 1).width = col.width;
    });
    headerRow.height = 30;

    // Ma'lumot satrlari
    rows.forEach((row) => {
      const r = ws.addRow(COLUMNS.map((col) => this.cell(row, col.key)));
      r.eachCell((c) => {
        c.alignment = { vertical: 'middle', wrapText: true };
        c.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
    });

    const arr = await wb.xlsx.writeBuffer();
    return Buffer.from(arr as ArrayBuffer);
  }

  // ── PDF (landshaft) ────────────────────────────────────────────────────────
  private buildPdf(rows: ReportRow[], from: Date, to: Date): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const pdf = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
        const chunks: Buffer[] = [];
        pdf.on('data', (c) => chunks.push(c as Buffer));
        pdf.on('end', () => resolve(Buffer.concat(chunks)));
        pdf.on('error', reject);

        // Cyrillic/Lotin shrift — bundle yoki Ubuntu tizim DejaVu shrifti
        const fontCandidates = [
          path.join(process.cwd(), 'assets', 'fonts', 'DejaVuSans.ttf'),
          '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        ];
        const font = fontCandidates.find((c) => fs.existsSync(c)) ?? 'Helvetica';
        pdf.font(font);

        const pageWidth = pdf.page.width - 60; // margin 30 ikki tomon
        const startX = 30;
        const totalUnits = COLUMNS.reduce((s, c) => s + c.width, 0);
        const colX: number[] = [];
        let x = startX;
        for (const col of COLUMNS) {
          colX.push(x);
          x += (col.width / totalUnits) * pageWidth;
        }
        colX.push(startX + pageWidth);

        // Sarlavha
        pdf.fontSize(14).text('Ҳужжатлар ҳисоботи', startX, 30, { width: pageWidth, align: 'center' });
        pdf.fontSize(9).fillColor('#64748b').text(
          `${fmtDate(from)} — ${fmtDate(to)}   •   Жами: ${rows.length} та`,
          startX,
          50,
          { width: pageWidth, align: 'center' },
        );
        pdf.fillColor('#000');

        let y = 74;
        const headH = 34;
        const rowH = 26;
        const pageBottom = pdf.page.height - 30;

        const drawHeader = () => {
          pdf.rect(startX, y, pageWidth, headH).fill('#f5821f');
          pdf.fillColor('#fff').fontSize(7.5);
          COLUMNS.forEach((col, i) => {
            pdf.text(col.header, colX[i] + 3, y + 5, {
              width: colX[i + 1] - colX[i] - 6,
              height: headH - 8,
              ellipsis: true,
            });
          });
          pdf.fillColor('#000');
          y += headH;
        };

        drawHeader();

        rows.forEach((row, ri) => {
          if (y + rowH > pageBottom) {
            pdf.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
            pdf.font(font);
            y = 30;
            drawHeader();
          }
          if (ri % 2 === 1) {
            pdf.rect(startX, y, pageWidth, rowH).fill('#f8fafc');
            pdf.fillColor('#000');
          }
          pdf.fontSize(7).fillColor('#0f172a');
          COLUMNS.forEach((col, i) => {
            pdf.text(this.cell(row, col.key), colX[i] + 3, y + 5, {
              width: colX[i + 1] - colX[i] - 6,
              height: rowH - 8,
              ellipsis: true,
              lineBreak: true,
            });
          });
          // Pastki chiziq
          pdf.moveTo(startX, y + rowH).lineTo(startX + pageWidth, y + rowH).lineWidth(0.4).strokeColor('#e2e8f0').stroke();
          y += rowH;
        });

        pdf.end();
      } catch (e) {
        reject(e as Error);
      }
    });
  }

  // ── JSON ko'rish (jadval preview) ──────────────────────────────────────────
  async preview(
    userId: string,
    canSeeAll: boolean,
    fromIso?: string,
    toIso?: string,
    type?: string,
    search?: string,
  ): Promise<ReportPreviewResult> {
    const from = fromIso ? new Date(fromIso) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toIso ? new Date(toIso) : new Date();
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    const rows = await this.fetchRows(userId, canSeeAll, from, to, type, search);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      total: rows.length,
      rows: rows.map((r) => ({
        ...r,
        createdAt: fmtDate(r.createdAt),
        agreedDate: r.agreedDate ? fmtDate(r.agreedDate) : null,
      })),
    };
  }

  // ── Umumiy kirish nuqtasi ──────────────────────────────────────────────────
  async generate(
    userId: string,
    canSeeAll: boolean,
    format: 'excel' | 'pdf',
    fromIso?: string,
    toIso?: string,
    type?: string,
    search?: string,
  ): Promise<{ filename: string; mime: string; buffer: Buffer }> {
    const from = fromIso ? new Date(fromIso) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toIso ? new Date(toIso) : new Date();
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    const rows = await this.fetchRows(userId, canSeeAll, from, to, type, search);
    const stamp = `${fmtDate(from)}_${fmtDate(to)}`.replace(/\./g, '-');

    if (format === 'excel') {
      const buffer = await this.buildExcel(rows, from, to);
      return {
        filename: `hisobot_${stamp}.xlsx`,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer,
      };
    }
    const buffer = await this.buildPdf(rows, from, to);
    return { filename: `hisobot_${stamp}.pdf`, mime: 'application/pdf', buffer };
  }
}
