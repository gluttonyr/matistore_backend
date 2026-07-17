import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { v4 as uuidv4 } from 'uuid';
import { BaseMapper } from '../../common/mappers/base.mapper';
import { Categorie } from '../entities/categorie.entity';
import { CreateCategorieDto } from '../dto/create-categorie.dto';
import { UpdateCategorieDto } from '../dto/update-categorie.dto';
import { CategorieResponseDto } from '../dto/categorie-response.dto';

@Injectable()
export class CategorieMapper extends BaseMapper<Categorie, CategorieResponseDto> {
  async toEntity(dto: CreateCategorieDto | UpdateCategorieDto): Promise<Partial<Categorie>> {
    const categorie = plainToInstance(Categorie, dto, { excludeExtraneousValues: false });
    categorie.trackingId = uuidv4();
    return categorie;
  }

  toResponse(entity: Categorie): CategorieResponseDto {
    const response = plainToInstance(CategorieResponseDto, entity, {
      excludeExtraneousValues: true,
    });
    delete (response as any).id;
    return response;
  }

  async toResponseList(entities: Categorie[]): Promise<CategorieResponseDto[]> {
    return Promise.all(entities.map((entity) => Promise.resolve(this.toResponse(entity))));
  }
}
