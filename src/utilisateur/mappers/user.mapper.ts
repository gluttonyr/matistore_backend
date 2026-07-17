import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { v4 as uuidv4 } from 'uuid';
import { BaseMapper } from '../../common/mappers/base.mapper';
import { User } from '../entities/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';

@Injectable()
export class UserMapper extends BaseMapper<User, UserResponseDto> {
  async toEntity(dto: CreateUserDto | UpdateUserDto): Promise<Partial<User>> {
    const user = plainToInstance(User, dto, { excludeExtraneousValues: false });
    user.trackingId = uuidv4(); // Nouveau trackingId à chaque requête
    return user;
  }

  toResponse(entity: User): UserResponseDto {
    const response = plainToInstance(UserResponseDto, entity, {
      excludeExtraneousValues: true,
    });
    // Ensure id is never exposed
    delete (response as any).id;
    return response;
  }

  async toResponseList(entities: User[]): Promise<UserResponseDto[]> {
    return Promise.all(entities.map((entity) => Promise.resolve(this.toResponse(entity))));
  }
}
