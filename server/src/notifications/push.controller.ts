import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { PushService } from './push.service';

// Mobil ilova qurilma token'ini ro'yxatdan o'tkazish/olib tashlash.
@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post('register')
  async register(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { token: string; platform?: string },
  ) {
    await this.push.saveToken(user.id, body.token, body.platform || 'android');
    return { ok: true };
  }

  @Post('unregister')
  async unregister(@Body() body: { token: string }) {
    await this.push.removeToken(body.token);
    return { ok: true };
  }
}
