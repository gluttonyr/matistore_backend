import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { DiscussionStatus, DiscussionType } from '../entities/discussion.entity';

export class CreateDiscussionDto {
  @IsNotEmpty()
  @IsString()
  titre!: string;

  @IsNotEmpty()
  @IsString()
  type!: DiscussionType;

  @IsNotEmpty()
  @IsString()
  statut!: DiscussionStatus;

  @IsOptional()
  @IsString()
  image?: string;
}
