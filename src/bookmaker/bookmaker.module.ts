import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bookmaker } from './entities/bookmaker.entity';
import { BookmakerController } from './bookmaker.controller';
import { BookmakerService } from './bookmaker.service';

@Module({
  imports: [TypeOrmModule.forFeature([Bookmaker])],
  controllers: [BookmakerController],
  providers: [BookmakerService],
  exports: [BookmakerService],
})
export class BookmakerModule {}
