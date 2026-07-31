import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ExternalMailService } from '../external-mail/external-mail.service';

const ALLOWED_AVATAR_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly externalMail: ExternalMailService,
  ) {}

  async findAll(requester?: { id: string; role?: string; canSeeProtected?: boolean }) {
    // Maxfiy loginlar: faqat admin yoki canSeeProtected yoqilgan xodimlar (va egasi o'zi) ko'radi
    const canSeeAll =
      !requester || requester.role === 'admin' || requester.canSeeProtected === true;
    const where = canSeeAll
      ? {}
      : { OR: [{ isProtected: false }, { id: requester.id }] };
    const users = await this.prisma.user.findMany({
      where,
      include: { department: true, position: true },
      orderBy: [
        { position: { rank: 'asc' } },
        { fullName: 'asc' },
      ],
    });
    return users.map((u) => this.sanitize(u));
  }

  // Admin: maxfiy loginlar ro'yxatini olish
  async getProtectedLogins() {
    const users = await this.prisma.user.findMany({
      where: { isProtected: true },
      select: { login: true },
      orderBy: { login: 'asc' },
    });
    return { logins: users.map((u) => u.login) };
  }

  // Admin: maxfiy loginlar ro'yxatini o'rnatish (ro'yxatdagilar maxfiy, qolganlar oddiy)
  async setProtectedLogins(logins: string[]) {
    const wanted = new Set(
      logins.map((l) => l.trim().toLowerCase()).filter((l) => l.length > 0),
    );
    const all = await this.prisma.user.findMany({ select: { id: true, login: true } });
    const protectedIds = all
      .filter((u) => wanted.has(u.login.toLowerCase()))
      .map((u) => u.id);
    await this.prisma.$transaction([
      this.prisma.user.updateMany({ data: { isProtected: false } }),
      ...(protectedIds.length > 0
        ? [
            this.prisma.user.updateMany({
              where: { id: { in: protectedIds } },
              data: { isProtected: true },
            }),
          ]
        : []),
    ]);
    return this.getProtectedLogins();
  }

  async findOne(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { department: true, position: true },
    });
    if (!u) throw new NotFoundException('Foydalanuvchi topilmadi');
    return this.sanitize(u);
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { login: dto.login } });
    if (existing) throw new ConflictException('Bunday login allaqachon mavjud');

    const rounds = parseInt(this.config.get('BCRYPT_ROUNDS', '12'), 10);
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    // Pochta turi: ichki (@pochta.local) yoki tashqi (@asaka-motors.uz)
    const mailType = dto.mailType ?? 'internal';
    let email: string;
    let externalData: Record<string, any> = {};
    if (mailType === 'external') {
      if (!dto.email) {
        throw new BadRequestException('Tashqi pochta uchun email manzili kiritilishi shart');
      }
      if (!dto.externalMailPassword) {
        throw new BadRequestException('Tashqi pochta uchun parol kiritilishi shart');
      }
      // Domen tekshiriladi, IMAP ulanishi sinaladi, parol shifrlanadi
      externalData = await this.externalMail.prepareConnectionData(
        dto.email,
        dto.externalMailPassword,
      );
      email = externalData.externalMailLogin;
    } else {
      email = dto.email ?? `${dto.login}@pochta.local`;
    }

    // O'z-o'ziga rahbar bo'lib qola olmaydi — yangi user uchun managerId boshqa userga ishora qilishi shart
    if (dto.managerId) {
      const mgr = await this.prisma.user.findUnique({ where: { id: dto.managerId } });
      if (!mgr) throw new BadRequestException('Tanlangan rahbar topilmadi');
    }

    const user = await this.prisma.user.create({
      data: {
        login: dto.login,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        email,
        departmentId: dto.departmentId,
        positionId: dto.positionId,
        managerId: dto.managerId,
        // Tashqi pochtali xodim avtomat tashqiga yubora oladi
        canSendExternal: mailType === 'external' ? true : (dto.canSendExternal ?? false),
        canSignExternal: dto.canSignExternal ?? false,
        role: dto.role ?? 'user',
        isAdmin: (dto.role ?? 'user') === 'admin', // legacy ustunni sinxron saqlaymiz
        canSeeProtected: dto.canSeeProtected ?? false,
        ...externalData,
      },
      include: { department: true, position: true },
    });

    return this.sanitize(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const data: any = { ...dto };
    delete data.password;
    delete data.mailType;
    delete data.externalMailPassword;
    // Rol o'zgarsa — legacy isAdmin ustunini sinxron saqlaymiz
    if (data.role !== undefined) {
      data.isAdmin = data.role === 'admin';
    }
    if (dto.password) {
      const rounds = parseInt(this.config.get('BCRYPT_ROUNDS', '12'), 10);
      data.passwordHash = await bcrypt.hash(dto.password, rounds);
    }

    // Pochta turi bo'yicha tashqi pochtani sozlash
    if (dto.mailType === 'external') {
      if (!dto.email) {
        throw new BadRequestException('Tashqi pochta uchun email manzili kiritilishi shart');
      }
      if (dto.externalMailPassword) {
        // Yangi parol kiritildi — qayta ulanamiz (tekshirib, shifrlab)
        const ext = await this.externalMail.prepareConnectionData(
          dto.email,
          dto.externalMailPassword,
        );
        Object.assign(data, ext);
        data.email = ext.externalMailLogin;
        data.canSendExternal = true;
      } else {
        // Parol kiritilmagan — faqat allaqachon ulangan bo'lsa ruxsat beramiz
        // (boshqa maydonlarni tahrirlashda tashqi parolni qayta kiritish shart emas)
        const current = await this.prisma.user.findUnique({
          where: { id },
          select: { externalMailEnabled: true, externalMailPasswordEnc: true },
        });
        if (!current?.externalMailEnabled || !current.externalMailPasswordEnc) {
          throw new BadRequestException('Tashqi pochtaga ulash uchun parol kiritilishi shart');
        }
        const em = dto.email.trim().toLowerCase();
        data.email = em;
        data.externalMailLogin = em;
      }
    } else if (dto.mailType === 'internal') {
      // Ichkiga o'tkazamiz — tashqi ulanishni uzamiz
      data.externalMailLogin = null;
      data.externalMailPasswordEnc = null;
      data.externalMailEnabled = false;
    }

    // O'z-o'ziga rahbar bo'lishni taqiqlaymiz
    if (dto.managerId !== undefined) {
      if (dto.managerId === id) {
        throw new BadRequestException("Xodim o'z-o'ziga rahbar bo'la olmaydi");
      }
      if (dto.managerId) {
        const mgr = await this.prisma.user.findUnique({ where: { id: dto.managerId } });
        if (!mgr) throw new BadRequestException('Tanlangan rahbar topilmadi');
      }
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data,
        include: { department: true, position: true },
      });
      return this.sanitize(updated);
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Foydalanuvchi topilmadi');
      throw e;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.user.delete({ where: { id } });
      return { ok: true };
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Foydalanuvchi topilmadi');
      throw e;
    }
  }

  async resetPassword(id: string, newPassword: string) {
    const rounds = parseInt(this.config.get('BCRYPT_ROUNDS', '12'), 10);
    const passwordHash = await bcrypt.hash(newPassword, rounds);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });
    return { ok: true };
  }

  // Foydalanuvchining o'zi parolini yangilashi — joriy parol tekshiriladi.
  async changeMyPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Joriy va yangi parolni kiriting');
    }
    if (newPassword.length < 6) {
      throw new BadRequestException("Yangi parol kamida 6 ta belgidan iborat bo'lishi shart");
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException("Joriy parol noto'g'ri");

    // Yangi parol eskisi bilan bir xil bo'lmasin
    const same = await bcrypt.compare(newPassword, user.passwordHash);
    if (same) {
      throw new BadRequestException('Yangi parol eskisidan farq qilishi kerak');
    }

    const rounds = parseInt(this.config.get('BCRYPT_ROUNDS', '12'), 10);
    const passwordHash = await bcrypt.hash(newPassword, rounds);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });
    return { ok: true };
  }

  async setActive(id: string, isActive: boolean) {
    await this.prisma.user.update({ where: { id }, data: { isActive } });
    return { ok: true };
  }

  // ── EDO tasdiqlash PIN-kodi (faqat hujjat tasdiqlash payti so'raladi) ─────

  async setApprovalPin(userId: string, newPin: string, currentPin?: string) {
    if (!/^\d{4}$/.test(newPin)) {
      throw new BadRequestException('PIN faqat 4 raqamdan iborat bo\'lishi shart');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { approvalPinHash: true },
    });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    // Agar foydalanuvchi avval PIN qo'ygan bo'lsa, eski PIN tekshiriladi
    if (user.approvalPinHash) {
      if (!currentPin) {
        throw new BadRequestException('Joriy PIN-kodni kiriting');
      }
      const ok = await bcrypt.compare(currentPin, user.approvalPinHash);
      if (!ok) throw new BadRequestException("Joriy PIN noto'g'ri");
    }

    const rounds = parseInt(this.config.get('BCRYPT_ROUNDS', '12'), 10);
    const hash = await bcrypt.hash(newPin, rounds);
    await this.prisma.user.update({
      where: { id: userId },
      data: { approvalPinHash: hash },
    });
    return { ok: true };
  }

  async clearApprovalPin(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { approvalPinHash: null },
    });
    return { ok: true };
  }

  // Hujjat tasdiqlash service'i tomonidan chaqiriladi
  async verifyApprovalPin(userId: string, pin: string): Promise<void> {
    if (!pin || !/^\d{4}$/.test(pin)) {
      throw new BadRequestException("PIN 4 raqamdan iborat bo'lishi shart");
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { approvalPinHash: true },
    });
    if (!user?.approvalPinHash) {
      throw new BadRequestException(
        'Tasdiqlash PIN-kodi o\'rnatilmagan. Profilingiz sozlamalaridan o\'rnating',
      );
    }
    const ok = await bcrypt.compare(pin, user.approvalPinHash);
    if (!ok) throw new BadRequestException("Noto'g'ri PIN-kod");
  }

  private avatarsDir(): string {
    return (
      this.config.get<string>('AVATARS_DIR') || 'C:\\D\\pochta\\storage\\avatars'
    );
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fayl yuborilmagan');
    if (!ALLOWED_AVATAR_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Faqat JPG, PNG, WEBP yoki GIF rasm yuklash mumkin');
    }
    if (file.size > MAX_AVATAR_BYTES) {
      throw new BadRequestException('Rasm hajmi 5 MB dan oshmasligi kerak');
    }

    const dir = this.avatarsDir();
    await fs.mkdir(dir, { recursive: true });

    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    const filename = `${uuid()}${ext}`;
    const fullPath = path.join(dir, filename);
    await fs.writeFile(fullPath, file.buffer);

    // eski avatarni o'chirish
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarPath: true },
    });
    if (existing?.avatarPath) {
      try {
        await fs.unlink(path.join(dir, existing.avatarPath));
      } catch {}
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarPath: filename },
      include: { department: true, position: true },
    });

    return this.sanitize(updated);
  }

  async deleteAvatar(userId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarPath: true },
    });
    if (existing?.avatarPath) {
      try {
        await fs.unlink(path.join(this.avatarsDir(), existing.avatarPath));
      } catch {}
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarPath: null },
      include: { department: true, position: true },
    });
    return this.sanitize(updated);
  }

  private sanitize(user: any) {
    const {
      passwordHash,
      failedLoginCount,
      lockedUntil,
      approvalPinHash,
      externalMailPasswordEnc,
      ...safe
    } = user;
    return { ...safe, hasApprovalPin: !!approvalPinHash };
  }
}
