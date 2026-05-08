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

const ALLOWED_AVATAR_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: { department: true, position: true },
      orderBy: [
        { position: { rank: 'asc' } },
        { fullName: 'asc' },
      ],
    });
    return users.map((u) => this.sanitize(u));
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
    const email = dto.email ?? `${dto.login}@pochta.local`;

    const user = await this.prisma.user.create({
      data: {
        login: dto.login,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        email,
        departmentId: dto.departmentId,
        positionId: dto.positionId,
        canSendExternal: dto.canSendExternal ?? false,
        isAdmin: dto.isAdmin ?? false,
      },
      include: { department: true, position: true },
    });

    return this.sanitize(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const data: any = { ...dto };
    delete data.password;
    if (dto.password) {
      const rounds = parseInt(this.config.get('BCRYPT_ROUNDS', '12'), 10);
      data.passwordHash = await bcrypt.hash(dto.password, rounds);
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

  async setActive(id: string, isActive: boolean) {
    await this.prisma.user.update({ where: { id }, data: { isActive } });
    return { ok: true };
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
    const { passwordHash, failedLoginCount, lockedUntil, ...safe } = user;
    return safe;
  }
}
