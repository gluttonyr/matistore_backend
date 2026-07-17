import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { v4 as uuidv4 } from 'uuid';
import { BaseMapper } from '../../common/mappers/base.mapper';
import { Sticker } from '../entities/sticker.entity';
import { CreateStickerDto } from '../dto/create-sticker.dto';
import { UpdateStickerDto } from '../dto/update-sticker.dto';
import { StickerResponseDto } from '../dto/sticker-response.dto';

@Injectable()
export class StickerMapper extends BaseMapper<Sticker, StickerResponseDto> {
  async toEntity(dto: CreateStickerDto | UpdateStickerDto): Promise<Partial<Sticker>> {
    const sticker = plainToInstance(Sticker, dto, { excludeExtraneousValues: false });
    sticker.trackingId = uuidv4();
    return sticker;
  }

  toResponse(entity: Sticker): StickerResponseDto {
    const response = plainToInstance(StickerResponseDto, entity, {
      excludeExtraneousValues: true,
    });
    delete (response as any).id;
    return response;
  }

  async toResponseList(entities: Sticker[]): Promise<StickerResponseDto[]> {
    return Promise.all(entities.map((entity) => Promise.resolve(this.toResponse(entity))));
  }
}
