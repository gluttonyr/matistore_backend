import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/admin.guard';
import { ApiResponse } from '../common/api-response.interface';
import { ReferralService } from './referral.service';

@Controller('referral')
@UseGuards(AuthGuard('jwt'))
export class ReferralController {
  constructor(private readonly referral: ReferralService) {}

  @Get('me')
  async me(@Req() req: any): Promise<ApiResponse> {
    return { data: await this.referral.getMe(Number(req.user.userId)), message: 'Parrainage', status: 200 };
  }

  @Post('code')
  async createCode(@Req() req: any): Promise<ApiResponse> {
    return { data: await this.referral.createCode(Number(req.user.userId)), message: 'Code de parrainage', status: 200 };
  }

  @Get('lookup')
  async lookup(@Req() req: any, @Query('code') code: string): Promise<ApiResponse> {
    return { data: await this.referral.lookupCode(code, Number(req.user.userId)), message: 'Parrain trouvé', status: 200 };
  }

  @Post('parrain')
  async setParrain(@Req() req: any, @Body('code') code: string): Promise<ApiResponse> {
    return { data: await this.referral.setParrain(Number(req.user.userId), code), message: 'Parrain enregistré', status: 200 };
  }

  @Post('prompt-seen')
  async promptSeen(@Req() req: any): Promise<ApiResponse> {
    return { data: await this.referral.markPromptSeen(Number(req.user.userId)), message: 'OK', status: 200 };
  }

  @Get('tournament')
  async tournament(@Req() req: any): Promise<ApiResponse> {
    return { data: await this.referral.getTournament(Number(req.user.userId)), message: 'Tournoi', status: 200 };
  }
}

@Controller('admin/referral')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class ReferralAdminController {
  constructor(private readonly referral: ReferralService) {}

  @Get('settings')
  async settings(): Promise<ApiResponse> {
    return { data: await this.referral.getAdminOverview(), message: 'Réglages du tournoi', status: 200 };
  }

  /** Applies to the next round; switching `active` off cancels the running round. */
  @Put('settings')
  async updateSettings(@Body() body: any): Promise<ApiResponse> {
    return { data: await this.referral.updateSettings(body ?? {}), message: 'Réglages enregistrés', status: 200 };
  }

  @Get('rounds')
  async rounds(@Query('limit') limit?: string): Promise<ApiResponse> {
    return { data: await this.referral.listRounds(Number(limit) || 20), message: 'Tours', status: 200 };
  }

  @Post('winners/:id/rewarded')
  async rewarded(@Param('id', ParseIntPipe) id: number, @Body('rewarded') rewarded: boolean, @Req() req: any): Promise<ApiResponse> {
    return { data: await this.referral.setRewarded(id, rewarded !== false, Number(req.user.userId)), message: 'Gagnant mis à jour', status: 200 };
  }

  @Get('stats')
  async stats(): Promise<ApiResponse> {
    return { data: await this.referral.stats(), message: 'Statistiques', status: 200 };
  }
}
