import { CreatePushDeviceDto } from './create-push-device.dto';

export class UpdatePushDeviceDto {
  userId?: string;
  token?: string;
  platform?: 'android' | 'ios';
  deviceId?: string;
  active?: boolean;
}
