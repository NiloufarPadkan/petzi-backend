import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaqItem } from './entities/faq-item.entity';
import { SupportTicket } from './entities/support-ticket.entity';
import {
  AdminFaqController,
  AdminTicketsController,
  PublicSupportController,
} from './support.controllers';
import { SupportService } from './support.service';

@Module({
  imports: [TypeOrmModule.forFeature([SupportTicket, FaqItem])],
  controllers: [
    AdminTicketsController,
    AdminFaqController,
    PublicSupportController,
  ],
  providers: [SupportService],
})
export class SupportModule {}
