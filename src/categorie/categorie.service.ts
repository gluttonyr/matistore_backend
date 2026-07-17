import { Injectable, BadRequestException } from '@nestjs/common';
import { CategorieRepository } from './categorie.repository';
import { CreateCategorieDto } from './dto/create-categorie.dto';
import { UpdateCategorieDto } from './dto/update-categorie.dto';
import { CategorieMapper } from './mappers/categorie.mapper';

@Injectable()
export class CategorieService {
  constructor(
    private readonly categorieRepository: CategorieRepository,
    private readonly categorieMapper: CategorieMapper,
  ) {}

  async create(payload: CreateCategorieDto) {
    const entity = await this.categorieMapper.toEntity(payload);
    const categorie = this.categorieRepository.create(entity);
    return this.categorieRepository.save(categorie);
  }

  findAll() {
    return this.categorieRepository.find();
  }

  findById(id: string) {
    return this.categorieRepository.findOne({ where: { trackingId: id } });
  }

  async update(id: string, payload: UpdateCategorieDto) {
    const categorie = await this.findById(id);
    if (!categorie) {
      throw new BadRequestException('Catégorie introuvable');
    }
    Object.assign(categorie, payload);
    return this.categorieRepository.save(categorie);
  }

  async remove(id: string) {
    const categorie = await this.findById(id);
    if (!categorie) {
      throw new BadRequestException('Catégorie introuvable');
    }
    return this.categorieRepository.remove(categorie);
  }
}
