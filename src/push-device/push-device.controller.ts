import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiResponse } from '../common/api-response.interface';
import { CreatePushDeviceDto } from './dto/create-push-device.dto';
import { UpdatePushDeviceDto } from './dto/update-push-device.dto';
import { PushDeviceMapper } from './mappers/push-device.mapper';
import { PushDeviceService } from './push-device.service';


@Controller('push-devices')
@UseGuards(AuthGuard('jwt'))
export class PushDeviceController {
  constructor(
    private readonly pushDeviceService: PushDeviceService,
    private readonly pushDeviceMapper: PushDeviceMapper,
  ) {}

  @Get()
  async findAll(@Req() req: any): Promise<ApiResponse> {
    const devices = await this.pushDeviceService.findByUser(req.user.userId);
    const response = await this.pushDeviceMapper.toResponseList(devices);
    return { data: response, message: 'Appareils push trouvés', status: 200 };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApiResponse> {
    const device = await this.pushDeviceService.findById(id);
    if (!device) {
      throw new BadRequestException(`Appareil push ${id} introuvable`);
    }
    return { data: this.pushDeviceMapper.toResponse(device), message: 'Appareil push trouvé', status: 200 };
  }

  @Post()
  async create(@Body() body: CreatePushDeviceDto,@Req() req: any): Promise<ApiResponse> {
    const userId = req.user.userId;
    const device = await this.pushDeviceService.create(body, userId);
    return { data: this.pushDeviceMapper.toResponse(device), message: 'Appareil push créé', status: 201 };
  }

  @Post('register')
  async register(@Req() req: any, @Body() body: Omit<CreatePushDeviceDto, 'userId'>): Promise<ApiResponse> {
    const device = await this.pushDeviceService.registerForUser(req.user.userId, body);
    return { data: this.pushDeviceMapper.toResponse(device), message: 'Appareil push enregistré', status: 201 };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdatePushDeviceDto): Promise<ApiResponse> {
    const device = await this.pushDeviceService.update(id, body);
    return { data: this.pushDeviceMapper.toResponse(device), message: 'Appareil push mis à jour', status: 200 };
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse> {
    await this.pushDeviceService.remove(id);
    return { data: null, message: 'Appareil push supprimé', status: 200 };
  }
}
