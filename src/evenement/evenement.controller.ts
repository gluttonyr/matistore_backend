import { Body, Controller, Delete, Get, Param, Post, Put, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EvenementService } from './evenement.service';
import { ApiResponse } from '../common/api-response.interface';
import { UploadService } from '../uploads/upload.service';
import { EvenementMapper } from './mappers/evenement.mapper';

@Controller('events')
export class EvenementController {
  constructor(
    private readonly evenementService: EvenementService,
    private readonly uploadService: UploadService,
    private readonly evenementMapper: EvenementMapper
  ) {}

  @Get()
  async findAll(): Promise<ApiResponse> {
    const events = await this.evenementService.findAll();
    const responseList = await this.evenementMapper.toResponseList(events);
    return { data: responseList, message: 'Liste des événements', status: 200 };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApiResponse> {
    const event = await this.evenementService.findById(id);
    if(event === null) {
      throw new BadRequestException(`Événement avec l'ID ${id} non trouvé`);
    }
    const responseData = await this.evenementMapper.toResponse(event);
    return { data: responseData, message: 'Événement trouvé', status: 200 };
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
      throw new BadRequestException('Les données de l\'événement sont requises');
    }

    if (file) {
      payload.coverImage = await this.uploadService.saveFile(prefix ?? 'event', folder ?? 'events', file);
    }

    const event = await this.evenementService.create(payload);
    const responseData = await this.evenementMapper.toResponse(event);
    return { data: responseData, message: 'Événement créé', status: 201 };
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
      throw new BadRequestException('Aucune donnée d\'événement envoyée');
    }

    if (file) {
      payload.coverImage = await this.uploadService.saveFile(prefix ?? 'event', folder ?? 'events', file);
    }

    const event = await this.evenementService.update(id, payload);
    const responseData = await this.evenementMapper.toResponse(event);
    return { data: responseData, message: 'Événement mis à jour', status: 200 };
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse> {
    await this.evenementService.remove(id);
    
    return { data: null, message: 'Événement supprimé', status: 200 };
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
