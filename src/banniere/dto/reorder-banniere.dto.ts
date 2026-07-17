import { IsArray, IsString } from 'class-validator';

export class ReorderBanniereDto {
  @IsArray()
  @IsString({ each: true })
  trackingIds!: string[];
}
