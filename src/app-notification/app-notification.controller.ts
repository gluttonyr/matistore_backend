import { Body, Controller, Get, Post, Req, UseGuards, ForbiddenException } from '@nestjs/common';
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
  async findMine(@Req() req: any): Promise<ApiResponse> {
    return {
      data: await this.appNotificationService.findForUser(Number(req.user.userId)),
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
