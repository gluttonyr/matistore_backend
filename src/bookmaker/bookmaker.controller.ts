import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiResponse } from '../common/api-response.interface';
import { BookmakerService } from './bookmaker.service';

@Controller('bookmakers')
@UseGuards(AuthGuard('jwt'))
export class BookmakerController {
  constructor(private readonly bookmakerService: BookmakerService) {}

  @Get()
  async findAll(): Promise<ApiResponse> {
    const data = (await this.bookmakerService.findAll()).map((bookmaker) => ({
      code: bookmaker.code,
      nom: bookmaker.nom,
      imageUrl: bookmaker.imageUrl ?? null,
      siteUrl: bookmaker.siteUrl ?? null,
      appSchemes: bookmaker.appSchemes ?? [],
      active: bookmaker.active,
    }));
    return { data, message: 'Bookmakers récupérés', status: 200 };
  }
}
