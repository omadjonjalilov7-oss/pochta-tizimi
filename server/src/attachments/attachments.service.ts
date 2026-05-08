import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';

const TAQIQLANGAN_KENGAYTMALAR = ['.exe', '.bat', '.cmd', '.ps1', '.vbs', '.scr', '.js', '.msi'];

@Injectable()
export class AttachmentsService {
  private readonly storageDir: string;
  private readonly maxFileSizeBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.storageDir =
      this.config.get<string>('ATTACHMENTS_DIR') || 'C:\\D\\pochta\\storage\\attachments';
    this.maxFileSizeBytes =
      parseInt(this.config.get('MAX_FILE_SIZE_MB', '50'), 10) * 1024 * 1024;
  }

  async upload(file: Express.Multer.File, uploadedBy: string) {
    if (!file) throw new BadRequestException('Fayl yuborilmagan');
    if (file.size > this.maxFileSizeBytes) {
      throw new BadRequestException(
        `Fayl hajmi ${this.maxFileSizeBytes / 1024 / 1024} MB dan katta bo'lmasligi kerak`,
      );
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (TAQIQLANGAN_KENGAYTMALAR.includes(ext)) {
      throw new BadRequestException(`'${ext}' kengaytmali fayllar taqiqlangan`);
    }

    const now = new Date();
    const subDir = path.join(
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
    );
    const fullDir = path.join(this.storageDir, subDir);
    await fs.mkdir(fullDir, { recursive: true });

    const id = uuid();
    const storedFilename = `${id}${ext}`;
    const fullPath = path.join(fullDir, storedFilename);
    const relativePath = path.join(subDir, storedFilename);

    await fs.writeFile(fullPath, file.buffer);

    const record = await this.prisma.attachment.create({
      data: {
        id,
        uploadedBy,
        filename: file.originalname,
        storedPath: relativePath,
        sizeBytes: BigInt(file.size),
        mimeType: file.mimetype,
      },
    });

    return {
      id: record.id,
      filename: record.filename,
      sizeBytes: Number(record.sizeBytes),
      mimeType: record.mimeType,
    };
  }

  async download(userId: string, attachmentId: string) {
    const att = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: {
          include: {
            recipients: { select: { userId: true } },
          },
        },
      },
    });
    if (!att) throw new NotFoundException('Fayl topilmadi');

    // ruxsat: yuklagan o'zi yoki xabar qatnashchilari
    let allowed = att.uploadedBy === userId;
    if (!allowed && att.message) {
      allowed =
        att.message.fromUserId === userId ||
        att.message.recipients.some((r) => r.userId === userId);
    }
    if (!allowed) throw new ForbiddenException('Bu faylga ruxsatingiz yo\'q');

    const fullPath = path.join(this.storageDir, att.storedPath);
    return {
      fullPath,
      filename: att.filename,
      mimeType: att.mimeType,
      sizeBytes: Number(att.sizeBytes),
    };
  }

  // Yetim fayllarni har kuni tunda tozalash (24 soat ichida xabarga biriktirilmagan)
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOrphans() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const orphans = await this.prisma.attachment.findMany({
      where: { messageId: null, createdAt: { lt: cutoff } },
    });
    for (const o of orphans) {
      try {
        await fs.unlink(path.join(this.storageDir, o.storedPath));
      } catch {}
      await this.prisma.attachment.delete({ where: { id: o.id } });
    }
  }
}
