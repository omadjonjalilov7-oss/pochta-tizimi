import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

// Admin, konselyariya (chancellery) yoki buxgalter rollari uchun ruxsat —
// statistika/hisobotlar. Buxgalter kanselyariyaning barcha imkoniyatlariga ega.
@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'chancellery' && role !== 'buxgalter') {
      throw new ForbiddenException('Bu bo\'lim faqat admin, konselyariya va buxgalter uchun');
    }
    return true;
  }
}
