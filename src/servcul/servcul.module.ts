import { Module } from '@nestjs/common';
import { BookmakerModule } from '../bookmaker/bookmaker.module';
import { ServculController } from './servcul.controller';
import { ServculService } from './servcul.service';

@Module({
  imports: [BookmakerModule],
  controllers: [ServculController],
  providers: [ServculService],
  exports: [ServculService],
})
export class ServculModule {}
