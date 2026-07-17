import { IsNotEmpty, IsBoolean, IsOptional, IsDate } from 'class-validator';

export class CreateDiscussionParticipantDto {
  @IsNotEmpty()
  discussionId!: string;

  @IsNotEmpty()
  userId!: string;

  @IsOptional()
  @IsDate()
  joinedAt?: Date;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;
}
