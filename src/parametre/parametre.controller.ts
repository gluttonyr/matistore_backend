import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ParametreService } from './parametre.service';
import { ApiResponse } from '../common/api-response.interface';
import { AuthGuard } from '@nestjs/passport';

@Controller('settings')
@UseGuards(AuthGuard('jwt'))
export class ParametreController {
  constructor(private readonly parametreService: ParametreService) {}

  @Get()
  async findAll(): Promise<ApiResponse> {
    const parametres = await this.parametreService.findAll();
    return { data: parametres, message: 'Liste des paramètres', status: 200 };
  }

  @Get(':code')
  async findByCode(@Param('code') code: string): Promise<ApiResponse> {
    const parametre = await this.parametreService.findByCode(code);
    return { data: parametre, message: 'Paramètre trouvé', status: 200 };
  }

  @Post()
  async create(@Body() body: Partial<any>): Promise<ApiResponse> {
    const parametre = await this.parametreService.create(body);
    return { data: parametre, message: 'Paramètre créé', status: 201 };
  }

  @Put(':code')
  async update(@Param('code') code: string, @Body() body: Partial<any>): Promise<ApiResponse> {
    const parametre = await this.parametreService.update(code, body);
    return { data: parametre, message: 'Paramètre mis à jour', status: 200 };
  }

  @Delete(':code')
  async remove(@Param('code') code: string): Promise<ApiResponse> {
    await this.parametreService.remove(code);
    return { data: null, message: 'Paramètre supprimé', status: 200 };
  }
}
