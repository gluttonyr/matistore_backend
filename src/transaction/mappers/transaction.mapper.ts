import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transaction } from '../entities/transaction.entity';
import { TransactionResponseDto } from '../dto/transaction-response.dto';

@Injectable()
export class TransactionMapper {
  toResponse(entity: Transaction): TransactionResponseDto {
    const response = plainToInstance(TransactionResponseDto, entity, { excludeExtraneousValues: true });
    response.userId = entity.user?.id;
    response.valideParId = entity.validePar?.id;
    return response;
  }
  toResponseList(entities: Transaction[]) { return entities.map((entity) => this.toResponse(entity)); }
}
