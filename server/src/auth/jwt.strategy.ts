import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  login: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'dev-secret-change-me',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    // Oxirgi faollik vaqtini yangilaymiz — pochta/edo/chat barcha so'rovlarda
    // shu yerdan o'tadi. Har so'rovda yozmaslik uchun 60s throttle: agar oxirgi
    // yangilanish 60s dan eski bo'lsa yozamiz. Fire-and-forget (javobni kutmaymiz).
    const now = Date.now();
    if (!user.lastSeenAt || now - user.lastSeenAt.getTime() > 60_000) {
      this.prisma.user
        .update({ where: { id: user.id }, data: { lastSeenAt: new Date(now) } })
        .catch(() => undefined);
    }

    return {
      id: user.id,
      login: user.login,
      role: user.role,
      canSeeProtected: user.canSeeProtected,
    };
  }
}
