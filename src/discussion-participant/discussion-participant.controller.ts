import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { DiscussionParticipantService } from './discussion-participant.service';
import { ApiResponse } from '../common/api-response.interface';

@Controller('discussion-participants')
export class DiscussionParticipantController {
  constructor(private readonly participantService: DiscussionParticipantService) {}

  @Get('discussion/:discussionId')
  async findByDiscussion(@Param('discussionId') discussionId: string): Promise<ApiResponse> {
    const participants = await this.participantService.findByDiscussion(discussionId);
    return { data: participants, message: 'Participants trouvés', status: 200 };
  }

  @Post()
  async addParticipant(@Body() body: Partial<any>): Promise<ApiResponse> {
    const participant = await this.participantService.addParticipant(body);
    return { data: participant, message: 'Participant ajouté', status: 201 };
  }

  @Delete(':id')
  async removeParticipant(@Param('id') id: string): Promise<ApiResponse> {
    await this.participantService.removeParticipant(id);
    return { data: null, message: 'Participant supprimé', status: 200 };
  }
}
