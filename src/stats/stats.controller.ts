import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StatsService } from './stats.service';
import { ApiResponse } from '../common/api-response.interface';
import { UtilisateurService } from 'src/utilisateur/utilisateur.service';
import { UserRole } from 'src/utilisateur/enums/user-role.enum';

@Controller('admin/stats')
@UseGuards(AuthGuard('jwt'))
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly utilisateurService: UtilisateurService,
  ) {}

  @Get()
  async getDashboardStats(@Req() req: any): Promise<ApiResponse> {
    const user = await this.utilisateurService.findUserById(req.user.userId);
    if (user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Vous n'êtes pas autorisé à accéder à cette ressource");
    }

    const data = await this.statsService.getAdminDashboardStats();
    return { data, message: 'Statistiques admin', status: 200 };
  }
}
