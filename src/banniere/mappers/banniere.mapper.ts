import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { v4 as uuidv4 } from 'uuid';
import { BaseMapper } from '../../common/mappers/base.mapper';
import { Banniere } from '../entities/banniere.entity';
import { CreateBanniereDto } from '../dto/create-banniere.dto';
import { UpdateBanniereDto } from '../dto/update-banniere.dto';
import { BanniereResponseDto } from '../dto/banniere-response.dto';

@Injectable()
export class BanniereMapper extends BaseMapper<Banniere, BanniereResponseDto> {
  async toEntity(dto: CreateBanniereDto | UpdateBanniereDto): Promise<Partial<Banniere>> {
    const banniere = plainToInstance(Banniere, dto, { excludeExtraneousValues: false });
    banniere.trackingId = uuidv4();
    return banniere;
  }

  toResponse(entity: Banniere): BanniereResponseDto {
    const response = plainToInstance(BanniereResponseDto, entity, {
      excludeExtraneousValues: true,
    });
    delete (response as any).id;
    return response;
  }

  async toResponseList(entities: Banniere[]): Promise<BanniereResponseDto[]> {
    return Promise.all(entities.map((entity) => Promise.resolve(this.toResponse(entity))));
  }
}
