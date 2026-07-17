import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { multerConfig } from './upload.config';
import { UploadController } from './upload.controller';

@Module({
    imports: [
        MulterModule.register(multerConfig)
    ],
    controllers: [UploadController],
    providers: [UploadService],
    exports: [UploadService]
})
export class UploadModule {}
