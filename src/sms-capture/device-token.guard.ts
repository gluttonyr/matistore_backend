import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { DeviceTokenService } from './device-token.service';

@Injectable()
export class DeviceTokenGuard implements CanActivate {
  constructor(private readonly tokens: DeviceTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const match = /^Device (\S+)$/.exec(req.headers?.authorization ?? '');
    const device = match ? await this.tokens.resolve(match[1]) : null;
    if (!device) throw new UnauthorizedException('Jeton d’appareil invalide');
    req.device = device;
    return true;
  }
}
