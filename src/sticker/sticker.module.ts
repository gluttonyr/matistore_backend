import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sticker } from './entities/sticker.entity';
import { StickerService } from './sticker.service';
import { StickerController } from './sticker.controller';
import { StickerRepository } from './sticker.repository';
import { UploadModule } from 'src/uploads/UploadModule';
import { StickerMapper } from './mappers/sticker.mapper';

@Module({
  imports: [TypeOrmModule.forFeature([Sticker]), UploadModule],
  providers: [StickerService, StickerRepository, StickerMapper],
  controllers: [StickerController],
  exports: [StickerService],
})
export class StickerModule {}
