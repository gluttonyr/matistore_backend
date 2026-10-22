import { SmsCandidatesQueryDto, SmsListQueryDto } from './dto/sms-query.dto';
import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiResponse } from '../common/api-response.interface';
import { TransactionService } from '../transaction/transaction.service';
import { DeviceTokenService } from './device-token.service';
import { DeviceTokenGuard } from './device-token.guard';
import { SmsCaptureService } from './sms-capture.service';
import { AssignSmsDto } from './dto/assign-sms.dto';
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

  // candidates must stay declared before :id.
  @Get('candidates')
  @UseGuards(AuthGuard('jwt'))
  async candidates(@Query() q: SmsCandidatesQueryDto, @Req() req: any): Promise<ApiResponse> {
    await this.assertActiveAdmin(req);
    return { data: await this.smsCapture.candidates(q.transactionId), message: 'Candidats récupérés', status: 200 };
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async list(@Query() q: SmsListQueryDto, @Req() req: any): Promise<ApiResponse> {
    await this.assertActiveAdmin(req);
    return { data: await this.smsCapture.list(q), message: 'SMS récupérés', status: 200 };
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async detail(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: any): Promise<ApiResponse> {
    await this.assertActiveAdmin(req);
    return { data: await this.smsCapture.detail(id), message: 'SMS récupéré', status: 200 };
  }

  @Post(':id/assign')
  @UseGuards(AuthGuard('jwt'))
  async assign(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: AssignSmsDto, @Req() req: any): Promise<ApiResponse> {
    await this.assertActiveAdmin(req);
    const data = await this.smsCapture.assign(id, Number(req.user.userId), dto);
    return { data, message: 'SMS attribué', status: 200 };
  }

  private async assertActiveAdmin(req: any) {
    this.assertAdmin(req);
    await this.tokens.assertActiveAdmin(Number(req.user.userId));
  }

  private assertAdmin(req: any) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Seul un administrateur peut gérer les appareils');
  }
}
