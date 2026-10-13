import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DiscussionService } from './discussion.service';
import { ApiResponse } from '../common/api-response.interface';
import { DiscussionType } from './entities/discussion.entity';
import { UtilisateurService } from 'src/utilisateur/utilisateur.service';
import { UserRole } from 'src/utilisateur/enums/user-role.enum';
import { AuthGuard } from '@nestjs/passport';
import { DiscussionMapper } from './mappers/discussion.mapper';

@Controller('discussions')
@UseGuards(AuthGuard('jwt'))
export class DiscussionController {
  constructor(private readonly discussionService: DiscussionService,private readonly utilisateurService:UtilisateurService,private readonly discussionMapper: DiscussionMapper) {}

  @Get()
  async findAll(
    @Req() req: any,
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
    @Query('search') searchQuery = '',
    @Query('category') category = 'all',
  ): Promise<ApiResponse> {
    const userId = req.user.userId;
    const user = await this.utilisateurService.findUserById(userId);
    if(user?.role!==UserRole.ADMIN){
      throw new ForbiddenException(
      'Vous n\'êtes pas autorisé à accéder à cette ressource',
    );
    }

    // Les anciennes versions mobiles n'envoient pas page/limit et attendent
    // encore une liste dans `data`. Le format paginé est réservé aux clients
    // qui demandent explicitement une page. L'aperçu et les non-lus sont lus
    // sans charger les messages de chaque discussion.
    if (pageQuery === undefined && limitQuery === undefined) {
      const { discussions, unreadByDiscussion } = await this.discussionService.findAll();
      const items = await this.discussionMapper.toResponseList(discussions, true);
      items.forEach((item) => {
        item.unreadCount = unreadByDiscussion.get(item.trackingId) ?? 0;
      });
      return { data: items, message: 'Liste des discussions', status: 200 };
    }

    const page = Math.max(1, Number.parseInt(pageQuery ?? '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(limitQuery ?? '25', 10) || 25));
    const result = await this.discussionService.findAdminPage(page, limit, searchQuery, category);
    const items = await this.discussionMapper.toResponseList(result.discussions);
    items.forEach((item) => {
      item.unreadCount = result.unreadByDiscussion.get(item.trackingId) ?? 0;
    });

    return {
      data: {
        items,
        total: result.total,
        page,
        limit,
        hasMore: page * limit < result.total,
        counts: result.counts,
      },
      message: 'Liste des discussions',
      status: 200,
    };
  }

  @Get(':id/profile')
  async getAdminUserProfile(@Param('id') id: string, @Req() req: any): Promise<ApiResponse> {
    const userId = req.user.userId;
    const user = await this.utilisateurService.findUserById(userId);
    if (user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Vous n\'êtes pas autorisé à accéder à cette ressource');
    }
    const profile = await this.discussionService.getAdminUserProfile(id);
    return { data: profile, message: 'Profil utilisateur', status: 200 };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApiResponse> {
    const discussion = await this.discussionService.findById(id);
    if (!discussion) {
      throw new Error('Discussion introuvable');
    }
    const responseDiscussion = await this.discussionMapper.toResponse(discussion);
    return { data: responseDiscussion, message: 'Discussion trouvée', status: 200 };
  }

  @Post()
  async create(@Body() body: Partial<any>): Promise<ApiResponse> {
    const discussion = await this.discussionService.create(body);
    const responseDiscussion = await this.discussionMapper.toResponse(discussion);
    return { data: responseDiscussion, message: 'Discussion créée', status: 201 };
  }
  @Get('unread/admin')
  async findUnreadForAdmin(@Req() req: any): Promise<ApiResponse> {
    const userId = req.user.userId;
    const user = await this.utilisateurService.findUserById(userId);
    if (user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Vous n\'êtes pas autorisé à accéder à cette ressource',
      );
    }
    const { discussions, unreadByDiscussion } = await this.discussionService.findWithUnreadForAdmin();
    const data = discussions.map((discussion) => {
      const response = this.discussionMapper.toResponse(discussion);
      response.unreadCount = unreadByDiscussion.get(discussion.trackingId) ?? 0;
      return response;
    });
    return { data, message: 'Discussions non lues', status: 200 };
  }

  @Get('unread/count')
  async getUnreadCount(@Req() req: any): Promise<ApiResponse> {
    const userId = req.user.userId;
    const user = await this.utilisateurService.findUserById(userId);
    const count = user?.role === UserRole.ADMIN
      ? await this.discussionService.countUnreadForAdmin()
      : await this.discussionService.countUnreadForUser(userId);
    return { data: count, message: 'Nombre de messages non lus', status: 200 };
  }

  @Get('user/:userId')
  async findDiscussionsByUser(@Param('userId') userId: string): Promise<ApiResponse> {
    console.log('Recherche des discussions pour l\'utilisateur avec ID :', userId);
    const discussions = await this.discussionService.getDiscussionByUser(userId);
    const responseDiscussions = await this.discussionMapper.toResponseList(discussions);
    return { data: responseDiscussions, message: 'Discussions trouvées', status: 200 };
  }
  @Get('type/:type')
  async findDiscussionsByType(@Param('type') type: DiscussionType): Promise<ApiResponse> {
    const discussions = await this.discussionService.getDiscussionByType(type);
    const responseDiscussions = await this.discussionMapper.toResponseList(discussions);
    return { data: responseDiscussions, message: 'Discussions trouvées', status: 200 };
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse> {
    await this.discussionService.remove(id);
    return { data: null, message: 'Discussion supprimée', status: 200 };
  }
}
