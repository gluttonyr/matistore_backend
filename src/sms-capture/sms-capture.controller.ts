import { Body, Controller, ForbiddenException, Post, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiResponse } from '../common/api-response.interface';
import { TransactionService } from '../transaction/transaction.service';
import { DeviceTokenService } from './device-token.service';
import { DeviceTokenGuard } from './device-token.guard';
import { SmsCaptureService } from './sms-capture.service';
import { SmsBatchDto } from './dto/sms-batch.dto';
import { SmsDeviceDto, SmsHeartbeatDto } from './dto/sms-heartbeat.dto';

// Scoped here: the app has no global ValidationPipe and adding one would change other endpoints.
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('sms-capture')
export class SmsCaptureController {
  constructor(
    private readonly tokens: DeviceTokenService,
    private readonly transactions: TransactionService,
    private readonly smsCapture: SmsCaptureService,
  ) {}

  @Post('device/register')
  @UseGuards(AuthGuard('jwt'))
  async register(@Body() body: SmsDeviceDto, @Req() req: any): Promise<ApiResponse> {
    this.assertAdmin(req);
    const token = await this.tokens.register(Number(req.user.userId), body.deviceId);
    return { data: { token }, message: 'Appareil enregistré', status: 200 };
  }

  @Post('device/revoke')
  @UseGuards(AuthGuard('jwt'))
  async revoke(@Body() body: SmsDeviceDto, @Req() req: any): Promise<ApiResponse> {
    this.assertAdmin(req);
    await this.tokens.revoke(Number(req.user.userId), body.deviceId);
    return { data: null, message: 'Appareil révoqué', status: 200 };
  }

  @Post('heartbeat')
  @UseGuards(DeviceTokenGuard)
  async heartbeat(@Body() body: SmsHeartbeatDto, @Req() req: any): Promise<ApiResponse> {
    const { adminId, deviceId } = req.device;
    const data = await this.transactions.captureHeartbeat(adminId, { deviceId: 'mati-pay-' + deviceId, ready: body.ready, reason: body.reason });
    return { data, message: 'État de capture enregistré', status: 200 };
  }

  @Post('batch')
  @UseGuards(DeviceTokenGuard)
  async batch(@Body() dto: SmsBatchDto, @Req() req: any): Promise<ApiResponse> {
    const data = await this.smsCapture.ingestBatch(req.device.adminId, req.device.deviceId, dto.sms);
    return { data, message: 'Lot traité', status: 200 };
  }

  private assertAdmin(req: any) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Seul un administrateur peut gérer les appareils');
  }
}
