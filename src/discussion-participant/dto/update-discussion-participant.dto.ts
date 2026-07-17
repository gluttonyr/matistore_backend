import { IsOptional, IsBoolean, IsDate } from 'class-validator';

export class UpdateDiscussionParticipantDto {
  @IsOptional()
  @IsDate()
  joinedAt?: Date;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;
}
