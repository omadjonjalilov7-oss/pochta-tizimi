import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

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
