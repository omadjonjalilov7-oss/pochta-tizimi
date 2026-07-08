import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { QrApprovalService } from './qr-approval.service';

@Injectable()
export class PdfGeneratorService {
  private fontPath: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly qrApproval: QrApprovalService,
  ) {
    // Cyrillic shrift uchun (O'zbek tilida)
    this.fontPath = path.join(process.cwd(), 'assets', 'fonts');
  }

  /**
   * Cyrillic font o'rnatish
   */
  private ensureFont(doc: PDFKit.PDFDocument) {
    try {
      // DejaVu fonts Cyrillic support qiladi
      const fontPath = path.join(this.fontPath, 'DejaVuSans.ttf');
      if (fs.existsSync(fontPath)) {
        doc.font(fontPath);
      }
    } catch (e) {
      // Fallback - default font
      doc.font('Helvetica');
    }
  }

  /**
   * Internal hujjat uchun PDF - tasdiqlovchilar jadval bilan
   */
  async generateInternalDocumentPdf(
    documentId: string,
    outputPath: string,
  ): Promise<void> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            login: true,
            position: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
        participants: {
          where: { role: 'approver' },
          orderBy: { order: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                login: true,
                position: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!doc) throw new Error('Hujjat topilmadi');

    // PDF document yaratish
    const pdfDoc = new PDFDocument({
      size: 'A4',
      margin: 40,
    });

    // Font o'rnatish
    this.ensureFont(pdfDoc);

    // Pipe to file
    const writeStream = fs.createWriteStream(outputPath);
    pdfDoc.pipe(writeStream);

    // Header
    pdfDoc.fontSize(14).font('Helvetica-Bold').text('POCHTA TIZIMI', { align: 'center' });
    pdfDoc.fontSize(10).text(`Hujjat raqami: ${doc.number}`, { align: 'center' });
    pdfDoc.text(`Sana: ${new Date().toLocaleDateString('uz-UZ')}`, { align: 'center' });
    pdfDoc.moveDown();

    // Document info
    pdfDoc.fontSize(12).font('Helvetica-Bold').text('Hujjat ma\'lumotlari');
    pdfDoc.fontSize(10).font('Helvetica');
    pdfDoc.text(`Sarlavha: ${doc.subject}`);
    pdfDoc.text(`Yaratuvchi: ${doc.createdBy.fullName} (${doc.createdBy.position?.name || 'N/A'})`);
    pdfDoc.text(`Bo'lim: ${doc.createdBy.department?.name || 'N/A'}`);
    pdfDoc.moveDown();

    // Hujjat matni
    pdfDoc.fontSize(11).text(doc.body);
    pdfDoc.moveDown(1.5);

    // Tasdiqlovchilar jadval
    pdfDoc.fontSize(12).font('Helvetica-Bold').text('Tasdiqlashuvchilar');
    pdfDoc.moveDown(0.5);

    // Table header
    const tableTop = pdfDoc.y;
    const col1X = 50;
    const col2X = 150;
    const col3X = 280;
    const col4X = 480;
    const rowHeight = 60;

    // Header row
    pdfDoc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('F.I.O', col1X, tableTop)
      .text('Lavozim', col2X, tableTop)
      .text('QR Kod', col3X, tableTop)
      .text('Tasdiq', col4X, tableTop);

    pdfDoc.moveTo(col1X, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Data rows
    let rowY = tableTop + 20;
    for (const participant of doc.participants) {
      const status = participant.status === 'approved' ? '✓' : participant.status === 'rejected' ? '✗' : '';

      pdfDoc
        .fontSize(9)
        .font('Helvetica')
        .text(participant.user.fullName, col1X, rowY)
        .text(participant.user.position?.name || 'N/A', col2X, rowY);

      // QR code o'rniga placeholder (actual QR image qo'shish mumkin)
      if (participant.qrCode) {
        pdfDoc.text('[QR]', col3X, rowY);
      }

      pdfDoc.text(status, col4X, rowY);

      rowY += rowHeight;
      pdfDoc.moveTo(col1X, rowY - 45).lineTo(550, rowY - 45).stroke();

      if (rowY > 700) {
        pdfDoc.addPage();
        rowY = 50;
      }
    }

    // Footer
    pdfDoc.moveDown();
    pdfDoc.fontSize(9).text('Hujjat avtomatik tizim tomonidan yaratildi', { align: 'center' });

    pdfDoc.end();

    return new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  /**
   * External document uchun director imzosi qo'shing
   */
  async addDirectorSignatureToPdf(
    inputPath: string,
    outputPath: string,
    directorName: string,
    directorQrCode: string,
  ): Promise<void> {
    // Bu yerda PDFKit qishqa ekanligiga ko'ra - external PDF'ga imzo qo'shish uchun
    // alohida kutubhona kerak (pdfkit-compose yoki shunga o'xshash)
    // Hozircha simple approach: copy + text qo'shish
    const pdfDoc = new PDFDocument({
      size: 'A4',
      margin: 40,
    });

    const writeStream = fs.createWriteStream(outputPath);
    pdfDoc.pipe(writeStream);

    // Existing PDF content (simplified - full implementation kerak bo'ladi)
    pdfDoc.fontSize(10).text(`Direktor: ${directorName}`);
    pdfDoc.text(`Imzo: [QR Kod]`);

    pdfDoc.end();

    return new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }
}
