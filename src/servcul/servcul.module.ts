import { Module } from '@nestjs/common';
import { ServculController } from './servcul.controller';
import { ServculService } from './servcul.service';

@Module({
  controllers: [ServculController],
  providers: [ServculService],
  exports: [ServculService],
})
export class ServculModule {}
