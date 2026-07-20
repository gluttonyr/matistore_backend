import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { MessageReactionService } from './message-reaction.service';
import { ApiResponse } from '../common/api-response.interface';
import { AuthGuard } from '@nestjs/passport';

@Controller('message-reactions')
@UseGuards(AuthGuard('jwt'))
export class MessageReactionController {
  constructor(private readonly reactionService: MessageReactionService) {}

  @Get('message/:messageId')
  async findByMessage(@Param('messageId') messageId: string): Promise<ApiResponse> {
    const reactions = await this.reactionService.findByMessage(messageId);
    return { data: reactions, message: 'Réactions trouvées', status: 200 };
  }

  @Get('message/:messageId/summary')
  async getReactionSummary(@Param('messageId') messageId: string): Promise<ApiResponse> {
    const summary = await this.reactionService.getReactionSummary(messageId);
    return { data: summary, message: 'Résumé des réactions', status: 200 };
  }

  @Post()
  async addReaction(@Body() body: Partial<any>): Promise<ApiResponse> {
    const reaction = await this.reactionService.addReaction(body);
    return { data: reaction, message: 'Réaction ajoutée', status: 201 };
  }

  @Delete('message/:messageId/user/:userId')
  async removeReaction(@Param('messageId') messageId: string, @Param('userId') userId: string): Promise<ApiResponse> {
    await this.reactionService.removeReaction(messageId, userId);
    return { data: null, message: 'Réaction supprimée', status: 200 };
  }
}
