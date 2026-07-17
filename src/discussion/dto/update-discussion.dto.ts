import { IsOptional, IsString } from 'class-validator';
import { DiscussionStatus, DiscussionType } from '../entities/discussion.entity';

export class UpdateDiscussionDto {
  @IsOptional()
  @IsString()
  titre?: string;

  @IsOptional()
  @IsString()
  type?: DiscussionType;

  @IsOptional()
  @IsString()
  statut?: DiscussionStatus;

  @IsOptional()
  active?: boolean;

  @IsOptional()
  @IsString()
  image?: string;
}
