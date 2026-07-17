import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { v4 as uuidv4 } from 'uuid';
import { BaseMapper } from '../../common/mappers/base.mapper';
import { Operateur } from '../entities/operateur.entity';
import { CreateOperateurDto } from '../dto/create-operateur.dto';
import { UpdateOperateurDto } from '../dto/update-operateur.dto';
import { OperateurResponseDto } from '../dto/operateur-response.dto';

@Injectable()
export class OperateurMapper extends BaseMapper<Operateur, OperateurResponseDto> {
  async toEntity(dto: CreateOperateurDto | UpdateOperateurDto): Promise<Partial<Operateur>> {
    const operateur = plainToInstance(Operateur, dto, { excludeExtraneousValues: false });
    operateur.trackingId = uuidv4();
    return operateur;
  }

  toResponse(entity: Operateur): OperateurResponseDto {
    const response = plainToInstance(OperateurResponseDto, entity, {
      excludeExtraneousValues: true,
    });
    delete (response as any).id;
    return response;
  }

  async toResponseList(entities: Operateur[]): Promise<OperateurResponseDto[]> {
    return Promise.all(entities.map((entity) => Promise.resolve(this.toResponse(entity))));
  }
}
