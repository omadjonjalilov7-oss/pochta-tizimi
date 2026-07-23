import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StaffGuard } from '../auth/guards/staff.guard';

@Controller('stats')
@UseGuards(JwtAuthGuard, StaffGuard)
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  overview(@Query('from') from?: string, @Query('to') to?: string) {
    return this.stats.overview(from, to);
  }

  @Get('departments')
  departments(@Query('from') from?: string, @Query('to') to?: string) {
    return this.stats.departments(from, to);
  }

  @Get('staff')
  staff(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.stats.staff(from, to, departmentId);
  }

  @Get('signing')
  signing(@Query('from') from?: string, @Query('to') to?: string) {
    return this.stats.signing(from, to);
  }

  @Get('approvals')
  approvals(@Query('from') from?: string, @Query('to') to?: string) {
    return this.stats.approvals(from, to);
  }
}
