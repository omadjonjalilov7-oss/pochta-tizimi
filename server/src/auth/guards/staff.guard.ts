import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

// Admin yoki konselyariya (chancellery) rollari uchun ruxsat — statistika/hisobotlar
@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'chancellery') {
      throw new ForbiddenException('Bu bo\'lim faqat admin va konselyariya uchun');
    }
    return true;
  }
}
