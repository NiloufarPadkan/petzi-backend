import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Conversation } from './entities/conversation.entity';
import {
  AdminMessagesController,
  UserMessagesController,
} from './messages.controllers';
import { MessagesService } from './messages.service';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, ChatMessage, User])],
  controllers: [AdminMessagesController, UserMessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
