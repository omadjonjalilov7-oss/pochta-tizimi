import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ParticipantStatus, DocumentStatus } from '@prisma/client';

@Injectable()
export class QrApprovalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Har bir tasdiqlovchi uchun noyob QR kod generate qiling
   */
  async generateQrCodeForParticipant(
    documentId: string,
    participantId: string,
    userId: string,
  ): Promise<string> {
    // QR code data - document ID + participant ID + secret token
    const token = crypto.randomBytes(16).toString('hex');
    const qrData = `${documentId}:${participantId}:${token}`;

    // QR code image data URL shaklida
    const qrImage = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
    });

    // Database'ga saqlash
    await this.prisma.documentParticipant.update({
      where: { id: participantId },
      data: { qrCode: qrData },
    });

    return qrImage;
  }

  /**
   * Tasdiqovchi statusini hisoblang - Kelishilingan/Kelishilinmagan/Rad etilgan/Qisman
   */
  async getApprovalStatus(documentId: string) {
    const participants = await this.prisma.documentParticipant.findMany({
      where: {
        documentId,
        role: 'approver',
      },
      include: {
        user: { select: { id: true, fullName: true, login: true } },
      },
    });

    const approved = participants.filter((p) => p.status === 'approved');
    const rejected = participants.filter((p) => p.status === 'rejected');
    const pending = participants.filter((p) => p.status === 'pending');

    return {
      total: participants.length,
      approved: approved.length,
      rejected: rejected.length,
      pending: pending.length,
      partially: approved.length > 0 && pending.length > 0,
      status:
        rejected.length > 0
          ? 'rejected' // Rad etilgan
          : approved.length === 0
            ? 'pending' // Kelishilinmagan
            : pending.length === 0
              ? 'approved' // Kelishilingan
              : 'partially_approved', // Qisman kelishilingan
      participants,
    };
  }

  /** Foydalanuvchi admin yoki kanselyariyami? */
  private async isStaff(userId: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return u?.role === 'admin' || u?.role === 'chancellery';
  }

  /**
   * Foydalanuvchi ko'ra oladigan, tasdiqlovchisi bor hujjat ID'lari.
   * Staff (admin/kanselyariya) — barcha hujjatlar; boshqalar — faqat o'zi
   * tasdiqlovchi bo'lgan hujjatlar.
   */
  private async approvalDocIds(userId: string): Promise<string[]> {
    const staff = await this.isStaff(userId);
    const parts = await this.prisma.documentParticipant.findMany({
      where: staff ? { role: 'approver' } : { userId, role: 'approver' },
      select: { documentId: true },
      distinct: ['documentId'],
    });
    return parts.map((p) => p.documentId);
  }

  /**
   * Foydalanuvchining barcha approval stats'ini olish.
   * Staff uchun — tizimdagi barcha hujjatlar holati.
   */
  async getAggregateApprovalStats(userId: string) {
    const docIds = await this.approvalDocIds(userId);

    const stats = {
      total: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
      partially_approved: 0,
    };

    for (const id of docIds) {
      const approvalStatus = await this.getApprovalStatus(id);
      stats.total += 1;

      if (approvalStatus.status === 'approved') {
        stats.approved += 1;
      } else if (approvalStatus.status === 'rejected') {
        stats.rejected += 1;
      } else if (approvalStatus.status === 'pending') {
        stats.pending += 1;
      } else if (approvalStatus.status === 'partially_approved') {
        stats.partially_approved += 1;
      }
    }

    return stats;
  }

  /**
   * Document'larni status bo'yicha filter qiling
   */
  async filterDocumentsByApprovalStatus(
    userId: string,
    status: 'approved' | 'pending' | 'rejected' | 'partially_approved',
    limit: number = 50,
    offset: number = 0,
  ) {
    // Ko'rish mumkin bo'lgan hujjatlar (staff — barchasi)
    const docIds = await this.approvalDocIds(userId);

    if (docIds.length === 0) {
      return { data: [], total: 0 };
    }

    // BARCHA mos hujjatlarni olamiz (paginate qilmaymiz — status filtri
    // xotirada bo'lgani uchun, avval filtrlab keyin bo'laklaymiz).
    const documents = await this.prisma.document.findMany({
      where: { id: { in: docIds } },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            login: true,
            avatarPath: true,
          },
        },
        participants: {
          where: { role: 'approver' },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                login: true,
                avatarPath: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Har bir hujjat uchun umumiy tasdiqlash holatini hisoblaymiz
    const withStatus = await Promise.all(
      documents.map(async (doc) => {
        const approvalStatus = await this.getApprovalStatus(doc.id);
        return { doc, approvalStatus };
      }),
    );

    // Avval status bo'yicha filtr, keyin bo'laklash (pagination)
    const matched = withStatus
      .filter((x) => x.approvalStatus.status === status)
      .map((x) => ({
        ...x.doc,
        approvalStats: {
          total: x.approvalStatus.total,
          approved: x.approvalStatus.approved,
          rejected: x.approvalStatus.rejected,
          pending: x.approvalStatus.pending,
        },
      }));

    const paged = matched.slice(offset, offset + limit);

    return {
      data: paged,
      total: matched.length,
    };
  }

  /**
   * QR kod orqali hujjatni tasdiqlash
   */
  async approveDocumentWithQr(
    documentId: string,
    participantId: string,
    qrCode: string,
  ) {
    const participant = await this.prisma.documentParticipant.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      throw new NotFoundException('Tasdiqlovchi topilmadi');
    }

    if (participant.qrCode !== qrCode) {
      throw new BadRequestException('QR kod noto\'g\'ri');
    }

    if (participant.status !== 'pending') {
      throw new BadRequestException('Bu hujjat allaqachon tasdiqlanagan yoki rad etilgan');
    }

    // Tasdiqlash
    await this.prisma.documentParticipant.update({
      where: { id: participantId },
      data: {
        status: ParticipantStatus.approved,
        actedAt: new Date(),
        approvalMethod: 'qr',
      },
    });

    // Audit log
    await this.prisma.documentAuditLog.create({
      data: {
        documentId,
        actorId: participant.userId,
        action: 'approved_with_qr',
      },
    });

    return { ok: true, status: 'approved' };
  }

  /**
   * QR kod orqali hujjatni rad etish
   */
  async rejectDocumentWithQr(
    documentId: string,
    participantId: string,
    qrCode: string,
    reason: string,
  ) {
    const participant = await this.prisma.documentParticipant.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      throw new NotFoundException('Tasdiqlovchi topilmadi');
    }

    if (participant.qrCode !== qrCode) {
      throw new BadRequestException('QR kod noto\'g\'ri');
    }

    if (participant.status !== 'pending') {
      throw new BadRequestException('Bu hujjat allaqachon tasdiqlanagan yoki rad etilgan');
    }

    // Rad etish
    await this.prisma.documentParticipant.update({
      where: { id: participantId },
      data: {
        status: ParticipantStatus.rejected,
        actedAt: new Date(),
        approvalMethod: 'qr',
        rejectReason: reason,
      },
    });

    // Document statusini rad etilgan ga o'zgartiring
    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.rejected,
      },
    });

    // Audit log
    await this.prisma.documentAuditLog.create({
      data: {
        documentId,
        actorId: participant.userId,
        action: 'rejected_with_qr',
        payload: { reason } as any,
      },
    });

    return { ok: true, status: 'rejected' };
  }
}
