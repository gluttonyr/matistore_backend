import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiResponse } from '../common/api-response.interface';
import { ServculService } from './servcul.service';

@Controller('servcul')
@UseGuards(AuthGuard('jwt'))
export class ServculController {
  constructor(private readonly servculService: ServculService) {}

  @Get('users/:userId')
  async findPlayer(@Param('userId', ParseIntPipe) userId: number): Promise<ApiResponse> {
    const data = await this.servculService.findPlayer(userId);
    return { data, message: 'Joueur récupéré', status: 200 };
  }
}
