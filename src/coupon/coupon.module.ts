import { Body, Controller, Delete, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../auth/admin.guard';
import { ApiResponse } from '../common/api-response.interface';
import { Bookmaker } from '../bookmaker/entities/bookmaker.entity';
import { AppNotificationModule } from '../app-notification/app-notification.module';
import { MessageModule } from '../message/message.module';
import { Coupon } from './coupon.entity';
import { CouponService } from './coupon.service';

@Controller('coupons')
@UseGuards(AuthGuard('jwt'))
export class CouponController {
  constructor(private readonly coupons: CouponService) {}

  @Get()
  async list(@Query('before') before?: string, @Query('limit') limit?: string): Promise<ApiResponse> {
    return { data: await this.coupons.list(before, Number(limit) || 20), message: 'Coupons', status: 200 };
  }

  @Get('home')
  async home(): Promise<ApiResponse> {
    return { data: await this.coupons.home(), message: 'Coupons du jour', status: 200 };
  }

  @Get(':id')
  async one(@Param('id') id: string): Promise<ApiResponse> {
    return { data: await this.coupons.findOne(id), message: 'Coupon', status: 200 };
  }
}

@Controller('admin/coupons')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class CouponAdminController {
  constructor(private readonly coupons: CouponService) {}

  /** Body: { imageUrl, codes: [{ bookmaker, code }], odds?, note?, notify? (default true) }. */
  @Post()
  async create(@Body() body: any, @Req() req: any): Promise<ApiResponse> {
    return { data: await this.coupons.create(body ?? {}, Number(req.user.userId)), message: 'Coupon publié', status: 201 };
  }

  @Patch(':id/status')
  async status(@Param('id', ParseUUIDPipe) id: string, @Body('status') status: string): Promise<ApiResponse> {
    return { data: await this.coupons.setStatus(id, status), message: 'Coupon mis à jour', status: 200 };
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse> {
    return { data: await this.coupons.remove(id), message: 'Coupon supprimé', status: 200 };
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Coupon, Bookmaker]), AppNotificationModule, MessageModule],
  controllers: [CouponController, CouponAdminController],
  providers: [CouponService],
})
export class CouponModule {}
