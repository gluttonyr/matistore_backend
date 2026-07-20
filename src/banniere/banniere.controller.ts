import { Body, Controller, Delete, Get, Param, Post, Put, UseInterceptors, UploadedFile, BadRequestException, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BanniereService } from './banniere.service';
import { ApiResponse } from '../common/api-response.interface';
import { UploadService } from '../uploads/upload.service';
import { BanniereMapper } from './mappers/banniere.mapper';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('banners')
export class BanniereController {
  constructor(
    private readonly banniereService: BanniereService,
    private readonly uploadService: UploadService,
    private readonly banniereMapper: BanniereMapper,
  ) {}

  @Get()
  async findAll(): Promise<ApiResponse> {
    const banners = await this.banniereService.findAll();
    const responseList = await this.banniereMapper.toResponseList(banners);
    return { data: responseList, message: 'Liste des bannières', status: 200 };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApiResponse> {
    const banniere = await this.banniereService.findById(id);
    if (banniere === null) {
      throw new BadRequestException(`Bannière avec l'ID ${id} non trouvée`);
    }
    const responseData = this.banniereMapper.toResponse(banniere);
    return { data: responseData, message: 'Bannière trouvée', status: 200 };
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
      throw new BadRequestException('Les données de la bannière sont requises');
    }

    if (file) {
      payload.image = await this.uploadService.saveFile(prefix ?? 'banner', folder ?? 'banners', file);
    }

    const banniere = await this.banniereService.create(payload);
    const responseData = this.banniereMapper.toResponse(banniere);
    return { data: responseData, message: 'Bannière créée', status: 201 };
  }

  @Put('reorder')
  async reorder(@Body('trackingIds') trackingIds: string[]): Promise<ApiResponse> {
    if (!Array.isArray(trackingIds) || trackingIds.length === 0) {
      throw new BadRequestException('La liste des identifiants est requise');
    }
    const banners = await this.banniereService.reorder(trackingIds);
    const responseList = await this.banniereMapper.toResponseList(banners);
    return { data: responseList, message: 'Ordre des bannières mis à jour', status: 200 };
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
      throw new BadRequestException('Aucune donnée de bannière envoyée');
    }

    if (file) {
      payload.image = await this.uploadService.saveFile(prefix ?? 'banner', folder ?? 'banners', file);
    }

    const banniere = await this.banniereService.update(id, payload);
    const responseData = this.banniereMapper.toResponse(banniere);
    return { data: responseData, message: 'Bannière mise à jour', status: 200 };
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse> {
    await this.banniereService.remove(id);
    return { data: null, message: 'Bannière supprimée', status: 200 };
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
