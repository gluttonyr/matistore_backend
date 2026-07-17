import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { v4 as uuidv4 } from 'uuid';
import { BaseMapper } from '../../common/mappers/base.mapper';
import { Evenement } from '../entities/evenement.entity';
import { CreateEvenementDto } from '../dto/create-evenement.dto';
import { UpdateEvenementDto } from '../dto/update-evenement.dto';
import { EvenementResponseDto } from '../dto/evenement-response.dto';
import { Categorie } from 'src/categorie/entities/categorie.entity';

@Injectable()
export class EvenementMapper extends BaseMapper<Evenement, EvenementResponseDto> {
  async toEntity(dto: CreateEvenementDto | UpdateEvenementDto): Promise<Partial<Evenement>> {
    const evenement = plainToInstance(Evenement, dto, { excludeExtraneousValues: false });
    evenement.trackingId = uuidv4();

    if ((dto as any).categorieTrackingId) {
      evenement.categorie = { trackingId: (dto as any).categorieTrackingId } as Categorie;
    }

    return evenement;
  }

  toResponse(entity: Evenement): EvenementResponseDto {
    const response = plainToInstance(EvenementResponseDto, entity, {
      excludeExtraneousValues: true,
    });
    response.userId = entity.user?.trackingId;
    response.categorieId = entity.categorie?.trackingId;
    delete (response as any).id;
    return response;
  }

  async toResponseList(entities: Evenement[]): Promise<EvenementResponseDto[]> {
    return Promise.all(entities.map((entity) => Promise.resolve(this.toResponse(entity))));
  }
}
