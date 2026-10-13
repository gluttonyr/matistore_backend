import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiResponse } from '../common/api-response.interface';
import { ServculService } from './servcul.service';

@Controller('servcul')
export class ServculController {
  constructor(private readonly servculService: ServculService) {}

  @Get('users/:userId')
  @UseGuards(AuthGuard('jwt'))
  async findPlayer(@Param('userId', ParseIntPipe) userId: number): Promise<ApiResponse> {
    const data = await this.servculService.findPlayer(userId);
    return { data, message: 'Joueur récupéré', status: 200 };
  }

  @Post('test/deposit')
  async testDeposit(@Body() body: unknown): Promise<ApiResponse> {
    const payload = this.asBody(body);
    const userId = this.parsePlayerId(payload.userId);
    const amount = typeof payload.amount === 'number' ? payload.amount : Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000) {
      throw new BadRequestException('amount doit être un nombre positif inférieur ou égal à 1000000000000');
    }

    const data = await this.servculService.addPlayerDeposit(userId, {
      lng: 'ru',
      summa: amount,
    });
    return { data, message: 'Dépôt Servcul exécuté', status: 200 };
  }

  @Post('test/withdrawal')
  async testWithdrawal(@Body() body: unknown): Promise<ApiResponse> {
    const payload = this.asBody(body);
    const userId = this.parsePlayerId(payload.userId);
    if (typeof payload.code !== 'string' || !payload.code.trim()) {
      throw new BadRequestException('code de retrait requis');
    }

    const data = await this.servculService.payoutPlayer(userId, {
      lng: 'ru',
      code: payload.code.trim(),
    });
    return { data, message: 'Retrait Servcul exécuté', status: 200 };
  }

  private asBody(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Un objet JSON est requis');
    }
    return value as Record<string, unknown>;
  }

  private parsePlayerId(value: unknown): number {
    if (
      (typeof value !== 'string' && typeof value !== 'number')
      || !/^\d+$/.test(String(value))
    ) {
      throw new BadRequestException('userId doit être un ID 1XBET numérique positif');
    }
    const userId = Number(value);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new BadRequestException('userId doit être un ID 1XBET numérique positif');
    }
    return userId;
  }
}
