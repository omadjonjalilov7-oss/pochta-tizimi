import { Module } from '@nestjs/common';
import { ContactGroupsService } from './contact-groups.service';
import { ContactGroupsController } from './contact-groups.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ContactGroupsService],
  controllers: [ContactGroupsController],
})
export class ContactGroupsModule {}
