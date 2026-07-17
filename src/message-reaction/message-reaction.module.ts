import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageReaction } from './entities/message-reaction.entity';
import { MessageReactionService } from './message-reaction.service';
import { MessageReactionController } from './message-reaction.controller';
import { MessageReactionRepository } from './message-reaction.repository';

@Module({
  imports: [TypeOrmModule.forFeature([MessageReaction])],
  providers: [MessageReactionService, MessageReactionRepository],
  controllers: [MessageReactionController],
  exports: [MessageReactionService],
})
export class MessageReactionModule {}
