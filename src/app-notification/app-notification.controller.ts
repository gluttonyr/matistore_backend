import { Body, Controller, Get, Post, Query, Req, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiResponse } from '../common/api-response.interface';
import { UserRole } from '../utilisateur/enums/user-role.enum';
import { AppNotificationService } from './app-notification.service';
import { BroadcastAppNotificationDto } from './dto/broadcast-app-notification.dto';

@Controller('app-notifications')
@UseGuards(AuthGuard('jwt'))
export class AppNotificationController {
  constructor(private readonly appNotificationService: AppNotificationService) {}

  @Get()
  async findMine(
    @Req() req: any,
    @Query('limit') rawLimit?: string,
    @Query('beforeId') rawBeforeId?: string,
  ): Promise<ApiResponse> {
    // Sans paramètres, on garde le format historique pour les anciennes versions mobiles.
    if (rawLimit === undefined && rawBeforeId === undefined) {
      return {
        data: await this.appNotificationService.findForUser(Number(req.user.userId)),
        message: 'Notifications trouvées',
        status: 200,
      };
    }

    const limit = rawLimit === undefined ? 20 : Number(rawLimit);
    const beforeId = rawBeforeId === undefined ? undefined : Number(rawBeforeId);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new BadRequestException('La limite doit être comprise entre 1 et 50');
    }
    if (beforeId !== undefined && (!Number.isSafeInteger(beforeId) || beforeId < 1)) {
      throw new BadRequestException('Le curseur de notification est invalide');
    }
    return {
      data: await this.appNotificationService.findForUser(Number(req.user.userId), { limit, beforeId }),
      message: 'Notifications trouvées',
      status: 200,
    };
  }

  @Post('broadcast')
  async broadcast(@Req() req: any, @Body() body: BroadcastAppNotificationDto): Promise<ApiResponse> {
    if (req.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Seul un administrateur peut envoyer une notification globale');
    }
    return {
      data: await this.appNotificationService.broadcast(body, Number(req.user.userId)),
      message: 'Notification enregistrée et transmise aux appareils actifs',
      status: 200,
    };
  }
}
