import { CreatePushDeviceDto } from './create-push-device.dto';

export class UpdatePushDeviceDto {
  token?: string;
  platform?: 'android' | 'ios';
  deviceId?: string;
  active?: boolean;
}
