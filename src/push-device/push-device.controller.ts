import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiResponse } from '../common/api-response.interface';
import { CreatePushDeviceDto } from './dto/create-push-device.dto';
import { UpdatePushDeviceDto } from './dto/update-push-device.dto';
import { PushDeviceMapper } from './mappers/push-device.mapper';
import { PushDeviceService } from './push-device.service';
import { BroadcastPushDto } from './dto/broadcast-push.dto';
import { UserRole } from '../utilisateur/enums/user-role.enum';
import { PushNotificationService } from '../notifications/push-notification.service';


@Controller('push-devices')
@UseGuards(AuthGuard('jwt'))
export class PushDeviceController {
  constructor(
    private readonly pushDeviceService: PushDeviceService,
    private readonly pushDeviceMapper: PushDeviceMapper,
    private readonly pushNotificationService: PushNotificationService,
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

  @Post('broadcast')
  async broadcast(@Req() req: any, @Body() body: BroadcastPushDto): Promise<ApiResponse> {
    if (req.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Seul un administrateur peut envoyer une notification globale');
    }
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const message = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!title || !message) {
      throw new BadRequestException('Le titre et le message sont requis');
    }
    if (title.length > 100 || message.length > 500) {
      throw new BadRequestException('Le titre est limité à 100 caractères et le message à 500 caractères');
    }
    const tokens = await this.pushDeviceService.findActiveTokensForUsers();
    await this.pushNotificationService.sendToTokens(tokens, title, message, { type: 'ADMIN_BROADCAST' });
    const recipientCount = tokens.length;
    return {
      data: { recipientCount },
      message: 'Notification globale transmise aux appareils actifs',
      status: 200,
    };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdatePushDeviceDto): Promise<ApiResponse> {
    const device = await this.pushDeviceService.update(id, body);
    return { data: this.pushDeviceMapper.toResponse(device), message: 'Appareil push mis à jour', status: 200 };
  }

  @Post('deactivate')
async deactivate(@Body('token') token: string): Promise<ApiResponse> {
  if (!token) {
    throw new BadRequestException('Le token push est requis');
  }
  await this.pushDeviceService.deactivateByToken(token);
  return { data: null, message: 'Appareil désactivé', status: 200 };
}

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse> {
    await this.pushDeviceService.remove(id);
    return { data: null, message: 'Appareil push supprimé', status: 200 };
  }
}
