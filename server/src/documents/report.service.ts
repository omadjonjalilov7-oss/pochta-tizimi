import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// ── Yorliqlar (O'zbek) ───────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  internal: 'Ichki',
  incoming: 'Kiruvchi',
  outgoing: 'Chiquvchi',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Qoralama',
  in_review: 'Kelishishda',
  in_progress: 'Ijroda',
  done: 'Bajarilgan',
  rejected: 'Rad etilgan',
  overdue: 'Muddati o‘tgan',
};

interface ReportRow {
  id: string;
  index: number;
  number: string;
  subject: string;
  type: string;
  typeRaw: string;
  status: string;
  createdBy: string;
  department: string;
  createdAt: Date;
  deadline: Date | null;
}

export interface ReportPreviewRow {
  id: string;
  index: number;
  number: string;
  subject: string;
  type: string;
  typeRaw: string;
  status: string;
  createdBy: string;
  department: string;
  createdAt: string;
  deadline: string | null;
}

export interface ReportPreviewResult {
  from: string;
  to: string;
  total: number;
  rows: ReportPreviewRow[];
}

const COLUMNS: { header: string; width: number; key: keyof ReportRow }[] = [
  { header: '№', width: 6, key: 'index' },
  { header: 'Raqami', width: 16, key: 'number' },
  { header: 'Mavzu', width: 42, key: 'subject' },
  { header: 'Turi', width: 12, key: 'type' },
  { header: 'Holati', width: 16, key: 'status' },
  { header: 'Yaratuvchi', width: 24, key: 'createdBy' },
  { header: 'Bo‘lim', width: 22, key: 'department' },
  { header: 'Yaratilgan', width: 14, key: 'createdAt' },
  { header: 'Muddat', width: 14, key: 'deadline' },
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
        deadline: true,
        createdBy: {
          select: { fullName: true, department: { select: { name: true } } },
        },
      },
    });

    return docs.map((d, i) => ({
      id: d.id,
      index: i + 1,
      number: d.number,
      subject: d.subject,
      type: TYPE_LABELS[d.type] ?? d.type,
      typeRaw: d.type,
      status: STATUS_LABELS[d.status] ?? d.status,
      createdBy: d.createdBy?.fullName ?? '-',
      department: d.createdBy?.department?.name ?? '-',
      createdAt: d.createdAt,
      deadline: d.deadline ?? null,
    }));
  }

  private cell(row: ReportRow, key: keyof ReportRow): string {
    const v = row[key];
    if (key === 'createdAt' || key === 'deadline') return fmtDate(v as Date | null);
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
    titleCell.value = `Hujjatlar hisoboti  (${fmtDate(from)} — ${fmtDate(to)})`;
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
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      ws.getColumn(idx + 1).width = col.width;
    });
    headerRow.height = 18;

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
        pdf.fontSize(14).text('Hujjatlar hisoboti', startX, 30, { width: pageWidth, align: 'center' });
        pdf.fontSize(9).fillColor('#64748b').text(
          `${fmtDate(from)} — ${fmtDate(to)}   •   Jami: ${rows.length} ta`,
          startX,
          50,
          { width: pageWidth, align: 'center' },
        );
        pdf.fillColor('#000');

        let y = 74;
        const rowH = 20;
        const pageBottom = pdf.page.height - 30;

        const drawHeader = () => {
          pdf.rect(startX, y, pageWidth, rowH).fill('#f5821f');
          pdf.fillColor('#fff').fontSize(8);
          COLUMNS.forEach((col, i) => {
            pdf.text(col.header, colX[i] + 3, y + 6, { width: colX[i + 1] - colX[i] - 6, ellipsis: true });
          });
          pdf.fillColor('#000');
          y += rowH;
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
          pdf.fontSize(7.5).fillColor('#0f172a');
          COLUMNS.forEach((col, i) => {
            pdf.text(this.cell(row, col.key), colX[i] + 3, y + 6, {
              width: colX[i + 1] - colX[i] - 6,
              ellipsis: true,
              lineBreak: false,
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
        deadline: r.deadline ? fmtDate(r.deadline) : null,
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
