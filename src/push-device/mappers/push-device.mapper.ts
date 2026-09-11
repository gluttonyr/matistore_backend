import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { BaseMapper } from '../../common/mappers/base.mapper';
import { PushDevice } from '../entities/push-device.entity';
import { CreatePushDeviceDto } from '../dto/create-push-device.dto';
import { UpdatePushDeviceDto } from '../dto/update-push-device.dto';
import { PushDeviceResponseDto } from '../dto/push-device-response.dto';

@Injectable()
export class PushDeviceMapper extends BaseMapper<PushDevice, PushDeviceResponseDto> {
  async toEntity(dto: CreatePushDeviceDto | UpdatePushDeviceDto): Promise<Partial<PushDevice>> {
    const entity = plainToInstance(PushDevice, dto, { excludeExtraneousValues: false });
    if (!entity.platform) {
      entity.platform = 'android';
    }
    return entity;
  }

  toResponse(entity: PushDevice): PushDeviceResponseDto {
    const response = plainToInstance(PushDeviceResponseDto, entity, {
      excludeExtraneousValues: true,
    });
    response.userId = entity.userId ?? entity.user?.trackingId ?? '';
    return response;
  }

  async toResponseList(entities: PushDevice[]): Promise<PushDeviceResponseDto[]> {
    return Promise.all(entities.map((entity) => Promise.resolve(this.toResponse(entity))));
  }
}
