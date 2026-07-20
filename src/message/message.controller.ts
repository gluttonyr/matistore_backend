import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MessageService } from './message.service';
import { ApiResponse } from '../common/api-response.interface';
import { MessageMapper } from './mappers/message.mapper';

@Controller('messages')
@UseGuards(AuthGuard('jwt'))

export class MessageController {
  constructor(private readonly messageService: MessageService,private readonly messageMapper: MessageMapper) {}

  @Get('discussion/:discussionId')
  async findByDiscussion(@Param('discussionId') discussionId: string): Promise<ApiResponse> {
    const messages = await this.messageService.findByDiscussion(discussionId);
    const responseMessages = await Promise.all(messages.map(message => this.messageMapper.toResponse(message)));
   
    return { data: responseMessages, message: 'Messages trouvés', status: 200 };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApiResponse> {
    const message = await this.messageService.findById(id);
    if (!message) {
      throw new Error('Message introuvable');
    }
    const responseMessage = await this.messageMapper.toResponse(message);
    return { data: responseMessage, message: 'Message trouvé', status: 200 };
  }

  @Post()
  async create(@Body() body: Partial<any>): Promise<ApiResponse> {
    const message = await this.messageService.create(body);
    const responseMessage = await this.messageMapper.toResponse(message);
    return { data: responseMessage, message: 'Message créé', status: 201 };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: Partial<any>): Promise<ApiResponse> {
    const message = await this.messageService.update(id, body);
    const responseMessage = await this.messageMapper.toResponse(message);
    return { data: responseMessage, message: 'Message mis à jour', status: 200 };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any): Promise<ApiResponse> {
    await this.messageService.remove(id, req.user.userId);
    return { data: null, message: 'Message supprimé', status: 200 };
  }
}
