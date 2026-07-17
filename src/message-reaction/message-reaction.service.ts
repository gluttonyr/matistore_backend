import { Injectable, BadRequestException } from '@nestjs/common';
import { MessageReactionRepository } from './message-reaction.repository';
import { MessageReaction } from './entities/message-reaction.entity';

@Injectable()
export class MessageReactionService {
  constructor(private readonly reactionRepository: MessageReactionRepository) {}

  async addReaction(reaction: Partial<MessageReaction>) {
    const existing = await this.reactionRepository.findOne({
      where: { message: { id: (reaction.message as any).id }, user: { id: (reaction.user as any).id } },
    });

    if (existing) {
      existing.typeEmoji = reaction.typeEmoji!;
      return this.reactionRepository.save(existing);
    }

    return this.reactionRepository.save(this.reactionRepository.create(reaction));
  }

  async removeReaction(messageId: string, userId: string) {
    return this.reactionRepository.delete({
      message: { id: messageId } as any,
      user: { id: userId } as any,
    });
  }

  findByMessage(messageId: string) {
    return this.reactionRepository.createQueryBuilder('reaction')
      .leftJoinAndSelect('reaction.message', 'message')
      .leftJoinAndSelect('reaction.user', 'user')
      .where('message.trackingId = :messageId', { messageId })
      .getMany();
  }

  async getReactionSummary(messageId: string) {
    const reactions = await this.findByMessage(messageId);
    const summary: Record<string, number> = {};

    reactions.forEach((reaction) => {
      summary[reaction.typeEmoji] = (summary[reaction.typeEmoji] || 0) + 1;
    });

    return summary;
  }
}
