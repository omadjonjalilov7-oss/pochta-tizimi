import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { login: dto.login },
      include: { department: true, position: true },
    });

    if (!user) {
      throw new UnauthorizedException('Login yoki parol noto\'g\'ri');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Akkauntingiz bloklangan. Administrator bilan bog\'laning.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minsLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(
        `Juda ko'p urinish. ${minsLeft} daqiqadan keyin qayta urinib ko'ring.`,
      );
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      const maxAttempts = parseInt(this.config.get('LOGIN_MAX_ATTEMPTS', '5'), 10);
      const lockMins = parseInt(this.config.get('LOGIN_LOCK_MINUTES', '15'), 10);
      const newCount = user.failedLoginCount + 1;
      const shouldLock = newCount >= maxAttempts;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: newCount,
          lockedUntil: shouldLock ? new Date(Date.now() + lockMins * 60_000) : null,
        },
      });

      await this.audit(user.id, 'login_failed', ip);
      throw new UnauthorizedException('Login yoki parol noto\'g\'ri');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await this.audit(user.id, 'login_success', ip);

    const expiresIn = dto.rememberMe
      ? this.config.get<string>('JWT_REMEMBER_EXPIRES_IN', '30d')
      : this.config.get<string>('JWT_EXPIRES_IN', '12h');

    const token = await this.jwt.signAsync(
      { sub: user.id, login: user.login, isAdmin: user.isAdmin },
      { expiresIn },
    );

    return {
      token,
      user: this.sanitize(user),
    };
  }

  async register(dto: RegisterDto) {
    // Login'ni tekshirish
    const existingByLogin = await this.prisma.user.findUnique({
      where: { login: dto.login },
    });
    if (existingByLogin) {
      throw new BadRequestException('Bu login allaqachon mavjud');
    }

    // Email'ni tekshirish
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingByEmail) {
      throw new BadRequestException('Bu email allaqachon ro\'yxatdan o\'tgan');
    }

    // Parolni xeshlash
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Yangi foydalanuvchi yaratish
    try {
      const user = await this.prisma.user.create({
        data: {
          fullName: dto.fullName,
          email: dto.email,
          login: dto.login,
          passwordHash,
          isActive: true,
          isAdmin: false,
          externalMailLogin: dto.externalMailLogin,
          externalMailPasswordEnc: dto.externalMailPassword, // TODO: encrypt this
          externalMailEnabled: true,
        },
        include: { department: true, position: true },
      });

      // Audit log
      await this.audit(user.id, 'register_success');

      return {
        message: 'Akkaunt muvaffaqiyatli yaratildi. Iltimos, kirish sahifasida login qiling.',
        user: this.sanitize(user),
      };
    } catch (e: any) {
      this.logger.error(`Register xatosi: ${e.message}`);
      throw new BadRequestException('Ro\'yxatdan o\'tishda xatolik yuz berdi');
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { department: true, position: true },
    });
    if (!user) throw new UnauthorizedException();
    return this.sanitize(user);
  }

  private sanitize(user: any) {
    const {
      passwordHash,
      failedLoginCount,
      lockedUntil,
      approvalPinHash,
      ...safe
    } = user;
    return { ...safe, hasApprovalPin: !!approvalPinHash };
  }

  private async audit(userId: string | null, action: string, ip?: string) {
    try {
      await this.prisma.auditLog.create({
        data: { userId, action, ipAddress: ip },
      });
    } catch (e) {
      this.logger.warn(`Audit log yozilmadi: ${e.message}`);
    }
  }
}
