import { Body, Controller, Delete, Get, Param, Post, Put, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StickerService } from './sticker.service';
import { ApiResponse } from '../common/api-response.interface';
import { UploadService } from '../uploads/upload.service';
import { StickerMapper } from './mappers/sticker.mapper';

@Controller('stickers')
export class StickerController {
  constructor(
    private readonly stickerService: StickerService,
    private readonly uploadService: UploadService,
    private readonly stickerMapper: StickerMapper,
  ) {}

  @Get()
  async findAll(): Promise<ApiResponse> {
    const stickers = await this.stickerService.findAll();
    const responseList = await this.stickerMapper.toResponseList(stickers);
    return { data: responseList, message: 'Liste des stickers', status: 200 };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApiResponse> {
    const sticker = await this.stickerService.findById(id);
    if (sticker === null) {
      throw new BadRequestException(`Sticker avec l'ID ${id} non trouvé`);
    }
    const responseData = this.stickerMapper.toResponse(sticker);
    return { data: responseData, message: 'Sticker trouvé', status: 200 };
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body('data') requestData: string,
    @Body('prefix') prefix: string,
    @Body('folder') folder: string,
  ): Promise<ApiResponse> {
    const payload = this.parseRequestData(requestData);
    if (!payload || Object.keys(payload).length === 0) {
      throw new BadRequestException('Les données du sticker sont requises');
    }

    if (file) {
      payload.image = await this.uploadService.saveFile(prefix ?? 'sticker', folder ?? 'stickers', file);
    }

    const sticker = await this.stickerService.create(payload);
    const responseData = this.stickerMapper.toResponse(sticker);
    return { data: responseData, message: 'Sticker créé', status: 201 };
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('data') requestData: string,
    @Body('prefix') prefix: string,
    @Body('folder') folder: string,
  ): Promise<ApiResponse> {
    const payload = requestData ? this.parseRequestData(requestData) : {};

    if (!file && (!payload || Object.keys(payload).length === 0)) {
      throw new BadRequestException('Aucune donnée de sticker envoyée');
    }

    if (file) {
      payload.image = await this.uploadService.saveFile(prefix ?? 'sticker', folder ?? 'stickers', file);
    }

    const sticker = await this.stickerService.update(id, payload);
    const responseData = this.stickerMapper.toResponse(sticker);
    return { data: responseData, message: 'Sticker mis à jour', status: 200 };
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse> {
    await this.stickerService.remove(id);
    return { data: null, message: 'Sticker supprimé', status: 200 };
  }

  private parseRequestData(requestData: string): any {
    if (!requestData) {
      return {};
    }

    try {
      return JSON.parse(requestData);
    } catch (error) {
      throw new BadRequestException("Le JSON envoyé est invalide");
    }
  }
}
