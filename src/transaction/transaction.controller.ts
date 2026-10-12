import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiResponse } from '../common/api-response.interface';
import { AdminCaptureDto } from './dto/admin-capture.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ResolveClaimDto } from './dto/resolve-claim.dto';
import { AdminCaptureHeartbeatDto } from './dto/admin-capture-heartbeat.dto';
import { AdminCaptureOverrideDto } from './dto/admin-capture-override.dto';
import { ResolveCaptureReconciliationDto } from './dto/resolve-capture-reconciliation.dto';
import { TransactionMapper } from './mappers/transaction.mapper';
import { TransactionService } from './transaction.service';

@Controller('transactions')
@UseGuards(AuthGuard('jwt'))
export class TransactionController {
  constructor(private readonly service: TransactionService, private readonly mapper: TransactionMapper) {}

  @Get('admin')
  async findAllForAdmin(@Req() req: any): Promise<ApiResponse> {
    this.assertAdmin(req);
    return {
      data: this.mapper.toResponseList(await this.service.findAllForAdmin()),
      message: 'Liste des transactions',
      status: 200,
    };
  }

  @Post('admin-capture')
  async processAdminCapture(@Body() body: AdminCaptureDto, @Req() req: any): Promise<ApiResponse> {
    this.assertAdmin(req);
    const result = await this.service.processAdminCapture(body, Number(req.user.userId));
    return {
      data: result,
      message: result.message ?? (result.matched ? 'Paiement associé à une transaction' : 'Aucune transaction correspondante'),
      status: 200,
    };
  }

  @Get('capture/status')
  async captureStatus(@Req() req: any): Promise<ApiResponse> {
    const capture = await this.service.getCaptureStatus();
    return {
      data: req.user.role === 'ADMIN' ? capture : { available: capture.available },
      message: 'État de la capture des paiements',
      status: 200,
    };
  }

  @Post('capture/heartbeat')
  async captureHeartbeat(@Body() body: AdminCaptureHeartbeatDto, @Req() req: any): Promise<ApiResponse> {
    this.assertAdmin(req);
    return { data: await this.service.captureHeartbeat(Number(req.user.userId), body), message: 'État de capture enregistré', status: 200 };
  }

  @Post('capture/manual-override')
  async setCaptureOverride(@Body() body: AdminCaptureOverrideDto, @Req() req: any): Promise<ApiResponse> {
    this.assertAdmin(req);
    return {
      data: await this.service.setCaptureManualOverride(Number(req.user.userId), body.enabled),
      message: body.enabled ? 'Ouverture manuelle des dépôts activée' : 'Ouverture manuelle désactivée',
      status: 200,
    };
  }

  @Post(':id/capture-reconcile')
  async resolveCaptureReconciliation(
    @Param('id') id: string,
    @Body() body: ResolveCaptureReconciliationDto,
    @Req() req: any,
  ): Promise<ApiResponse> {
    this.assertAdmin(req);
    const transaction = await this.service.resolveCaptureReconciliation(id, Number(req.user.userId), body);
    return { data: this.mapper.toResponse(transaction), message: 'Dépôt rapproché manuellement', status: 200 };
  }

  @Post(':id/withdrawal/validate')
  async validateManualWithdrawal(@Param('id') id: string, @Req() req: any): Promise<ApiResponse> {
    this.assertAdmin(req);
    const transaction = await this.service.validateManualWithdrawal(id, Number(req.user.userId));
    return { data: this.mapper.toResponse(transaction), message: 'Retrait payé et validé', status: 200 };
  }

  @Get()
  async findMine(@Req() req: any): Promise<ApiResponse> {
    if (req.user.role === 'ADMIN') {
      return {
        data: this.mapper.toResponseList(await this.service.findAllForAdmin()),
        message: 'Liste des transactions',
        status: 200,
      };
    }
    return {
      data: this.mapper.toResponseList(await this.service.findByUser(Number(req.user.userId))),
      message: 'Liste des transactions',
      status: 200,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any): Promise<ApiResponse> {
    const transaction = await this.service.findById(
      id,
      req.user.role === 'ADMIN' ? undefined : Number(req.user.userId),
    );
    return { data: this.mapper.toResponse(transaction), message: 'Transaction trouvée', status: 200 };
  }

  @Post()
  async create(@Body() body: CreateTransactionDto, @Req() req: any): Promise<ApiResponse> {
    const transaction = await this.service.create(body, Number(req.user.userId));
    return { data: this.mapper.toResponse(transaction), message: 'Transaction créée', status: 201 };
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Req() req: any): Promise<ApiResponse> {
    const transaction = await this.service.cancel(id, Number(req.user.userId));
    return { data: this.mapper.toResponse(transaction), message: 'Transaction annulée', status: 200 };
  }

  @Post(':id/claim')
  async claimRejected(@Param('id') id: string, @Req() req: any): Promise<ApiResponse> {
    const transaction = await this.service.claimRejected(id, Number(req.user.userId));
    return { data: this.mapper.toResponse(transaction), message: 'Réclamation envoyée', status: 200 };
  }

  @Post(':id/claim/resolve')
  async resolveClaim(
    @Param('id') id: string,
    @Body() body: ResolveClaimDto,
    @Req() req: any,
  ): Promise<ApiResponse> {
    this.assertAdmin(req);
    const transaction = await this.service.resolveClaim(id, Number(req.user.userId), body);
    return { data: this.mapper.toResponse(transaction), message: 'Réclamation traitée', status: 200 };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateTransactionDto, @Req() req: any): Promise<ApiResponse> {
    this.assertAdmin(req);
    const transaction = await this.service.update(id, body, Number(req.user.userId));
    return { data: this.mapper.toResponse(transaction), message: 'Transaction mise à jour', status: 200 };
  }

  private assertAdmin(req: any) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Seul un administrateur peut traiter une transaction');
  }
}
