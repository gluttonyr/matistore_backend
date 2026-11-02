import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../utilisateur/entities/user.entity';
import { UserRole } from '../utilisateur/enums/user-role.enum';

// Use after AuthGuard('jwt'). The role is read from the database, not the token:
// older Google/Apple tokens carry no role, and a demoted admin must lose access at once.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const userId = Number(context.switchToHttp().getRequest().user?.userId);
    const user = Number.isSafeInteger(userId)
      ? await this.dataSource.getRepository(User).findOne({ where: { id: userId }, select: { id: true, role: true, active: true } })
      : null;
    if (user?.role !== UserRole.ADMIN || !user.active) {
      throw new ForbiddenException('Action réservée aux administrateurs');
    }
    return true;
  }
}
