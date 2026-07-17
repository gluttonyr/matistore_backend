import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { OperateurService } from './operateur.service';
import { CreateOperateurDto } from './dto/create-operateur.dto';
import { UpdateOperateurDto } from './dto/update-operateur.dto';
import { ApiResponse } from '../common/api-response.interface';
import { AuthGuard } from '@nestjs/passport';
import { OperateurMapper } from './mappers/operateur.mapper';

@Controller('operateurs')
@UseGuards(AuthGuard('jwt'))
export class OperateurController {
  constructor(private readonly operateurService: OperateurService,private readonly operateurMapper: OperateurMapper) {}

  @Get()
  async findAll(): Promise<ApiResponse> {
    const operateurs = await this.operateurService.findAll();
    const responseOperateurs = await this.operateurMapper.toResponseList(operateurs);
    return { data: responseOperateurs, message: 'Liste des opérateurs', status: 200 };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApiResponse> {
    const operateur = await this.operateurService.findById(id);
    if (!operateur) {
      throw new Error('Opérateur introuvable');
    }
    const responseOperateur = await this.operateurMapper.toResponse(operateur);
    return { data: responseOperateur, message: 'Opérateur trouvé', status: 200 };
  }

  @Post()
  async create(@Body() body: CreateOperateurDto): Promise<ApiResponse> {
    const operateur = await this.operateurService.create(body);
    const responseOperateur = await this.operateurMapper.toResponse(operateur);
    return { data: responseOperateur, message: 'Opérateur créé', status: 201 };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateOperateurDto): Promise<ApiResponse> {
    const operateur = await this.operateurService.update(id, body);
    const responseOperateur = await this.operateurMapper.toResponse(operateur);
    return { data: responseOperateur, message: 'Opérateur mis à jour', status: 200 };
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse> {
    await this.operateurService.remove(id);
    return { data: null, message: 'Opérateur supprimé', status: 200 };
  }
}
