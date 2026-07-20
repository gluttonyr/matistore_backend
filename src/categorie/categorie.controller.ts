import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CategorieService } from './categorie.service';
import { CreateCategorieDto } from './dto/create-categorie.dto';
import { UpdateCategorieDto } from './dto/update-categorie.dto';
import { ApiResponse } from '../common/api-response.interface';
import { CategorieMapper } from './mappers/categorie.mapper';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('categories')
export class CategorieController {
  constructor(private readonly categorieService: CategorieService, private readonly categorieMapper: CategorieMapper) {}

  @Get()
  async findAll(): Promise<ApiResponse> {
    const categories = await this.categorieService.findAll();
    const responseList = await this.categorieMapper.toResponseList(categories);
    return { data: responseList, message: 'Liste des catégories', status: 200 };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApiResponse> {
    const categorie = await this.categorieService.findById(id);
    if(!categorie) {
      throw new Error(`Catégorie avec l'ID ${id} non trouvée`);
    }
    const responseData = await this.categorieMapper.toResponse(categorie);
    return { data: responseData, message: 'Catégorie trouvée', status: 200 };
  }

  @Post()
  async create(@Body() body: CreateCategorieDto): Promise<ApiResponse> {
    const categorie = await this.categorieService.create(body);
    const responseData = await this.categorieMapper.toResponse(categorie);
    return { data: responseData, message: 'Catégorie créée', status: 201 };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateCategorieDto): Promise<ApiResponse> {
    const categorie = await this.categorieService.update(id, body);
    const responseData = await this.categorieMapper.toResponse(categorie);
    return { data: responseData, message: 'Catégorie mise à jour', status: 200 };
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse> {
    await this.categorieService.remove(id);
    return { data: null, message: 'Catégorie supprimée', status: 200 };
  }
}
