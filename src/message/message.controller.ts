import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MessageService } from './message.service';
import { ApiResponse } from '../common/api-response.interface';
import { MessageMapper } from './mappers/message.mapper';
import { DiscussionService } from 'src/discussion/discussion.service';
import { UtilisateurService } from 'src/utilisateur/utilisateur.service';

@Controller('messages')
@UseGuards(AuthGuard('jwt'))

export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly messageMapper: MessageMapper,
    private readonly discussionService: DiscussionService,
    private readonly utilisateurService: UtilisateurService,
  ) {}



@Get('discussion/:discussionId')
async findByDiscussion(
  @Param('discussionId') discussionId: string,
  @Req() req: any,
  @Query('before') before?: string,
  @Query('limit') limitQuery?: string,
): Promise<ApiResponse> {
  await this.discussionService.assertAccess(discussionId, Number(req.user.userId));
  const limit = limitQuery === undefined
    ? undefined
    : Math.min(100, Math.max(1, Number.parseInt(limitQuery, 10) || 50));
  const messages = await this.messageService.findByDiscussion(discussionId, before, limit);
  const responseMessages = await Promise.all(messages.map(message => this.messageMapper.toResponse(message)));
  return { data: responseMessages, message: 'Messages trouvés', status: 200 };
}


  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any): Promise<ApiResponse> {
    const message = await this.messageService.findById(id);
    if (!message) {
      throw new Error('Message introuvable');
    }
    await this.discussionService.assertAccess(message.discussion.trackingId, Number(req.user.userId));
    const responseMessage = await this.messageMapper.toResponse(message);
    return { data: responseMessage, message: 'Message trouvé', status: 200 };
  }

  @Post()
  async create(@Body() body: Partial<any>, @Req() req: any): Promise<ApiResponse> {
    const discussionId = body?.discussion?.trackingId;
    if (typeof discussionId !== 'string') {
      throw new BadRequestException('La discussion est requise');
    }
    await this.discussionService.assertAccess(discussionId, Number(req.user.userId));
    // The sender is always the authenticated user, never a value taken from the body.
    const sender = await this.utilisateurService.findUserById(Number(req.user.userId));
    if (!sender) {
      throw new BadRequestException('Utilisateur introuvable');
    }
    const message = await this.messageService.create({
      contenu: body.contenu,
      type: body.type,
      image: body.image,
      discussion: { trackingId: discussionId } as any,
      sender: { trackingId: sender.trackingId } as any,
    });
    const responseMessage = await this.messageMapper.toResponse(message);
    return { data: responseMessage, message: 'Message créé', status: 201 };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: Partial<any>, @Req() req: any): Promise<ApiResponse> {
    const existing = await this.messageService.findById(id);
    if (!existing) {
      throw new BadRequestException('Message introuvable');
    }
    if (existing.sender?.id !== Number(req.user.userId)) {
      throw new ForbiddenException('Vous ne pouvez modifier que vos propres messages');
    }
    const message = await this.messageService.update(id, { contenu: body?.contenu });
    const responseMessage = await this.messageMapper.toResponse(message);
    return { data: responseMessage, message: 'Message mis à jour', status: 200 };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any): Promise<ApiResponse> {
    await this.messageService.remove(id, req.user.userId);
    return { data: null, message: 'Message supprimé', status: 200 };
  }
}
