import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiResponse } from '../common/api-response.interface';
import { AdminCaptureDto } from './dto/admin-capture.dto';
import { ClientReferenceDto } from './dto/client-reference.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { RejectTransactionDto } from './dto/reject-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
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
    const result = await this.service.processAdminCapture(body);
    return { data: result, message: result.matched ? 'Paiement associé à une transaction' : 'Aucune transaction correspondante', status: 200 };
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

  @Post(':id/client-reference')
  async reportClientReference(
    @Param('id') id: string,
    @Body() body: ClientReferenceDto,
    @Req() req: any,
  ): Promise<ApiResponse> {
    const transaction = await this.service.reportClientReference(id, Number(req.user.userId), body);
    return { data: this.mapper.toResponse(transaction), message: 'Référence reçue, vérification en cours', status: 200 };
  }

  @Post(':id/proof')
  async submitProof(@Param('id') id: string, @Body('preuveFichier') path: string, @Req() req: any): Promise<ApiResponse> {
    const transaction = await this.service.submitProof(id, Number(req.user.userId), path);
    return { data: this.mapper.toResponse(transaction), message: 'Preuve envoyée', status: 200 };
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Req() req: any): Promise<ApiResponse> {
    const transaction = await this.service.cancel(id, Number(req.user.userId));
    return { data: this.mapper.toResponse(transaction), message: 'Transaction annulée', status: 200 };
  }

  @Post(':id/validate')
  async validateManually(@Param('id') id: string, @Req() req: any): Promise<ApiResponse> {
    this.assertAdmin(req);
    const transaction = await this.service.validateManually(id, Number(req.user.userId));
    return { data: this.mapper.toResponse(transaction), message: 'Transaction validée', status: 200 };
  }

  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() body: RejectTransactionDto,
    @Req() req: any,
  ): Promise<ApiResponse> {
    this.assertAdmin(req);
    const transaction = await this.service.reject(id, Number(req.user.userId), body);
    return { data: this.mapper.toResponse(transaction), message: 'Transaction rejetée', status: 200 };
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
