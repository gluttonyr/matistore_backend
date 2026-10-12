import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ServculService } from './servcul.service';

describe('ServculService', () => {
  const values = {
    SERVCUL_HASH: 'fhd.ncbf9hf2ythr',
    SERVCUL_CASHIER_PASS: '123123',
    SERVCUL_CASHDESK_ID: '77',
    SERVCUL_API_BASE_URL: 'https://partners.servcul.com/CashdeskBotAPI/',
  };
  let service: ServculService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new ServculService(new ConfigService(values));
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('sends a signed player deposit using backend cashier configuration', async () => {
    await service.addPlayerDeposit(76, { lng: 'ru', summa: 100 });

    const [url, request] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = request.headers as Record<string, string>;
    const expectedPartOne = sha256(
      'hash=fhd.ncbf9hf2ythr&lng=ru&userid=76',
    );
    const expectedPartTwo = md5(
      'summa=100&cashierpass=123123&cashdeskid=77',
    );

    expect(url).toBe('https://partners.servcul.com/CashdeskBotAPI/Deposit/76/Add');
    expect(headers.sign).toBe(sha256(`${expectedPartOne}${expectedPartTwo}`));
    expect(JSON.parse(request.body as string)).toEqual({
      cashdeskId: 77,
      lng: 'ru',
      summa: 100,
      confirm: md5('76:fhd.ncbf9hf2ythr'),
    });
  });

  it('does not call Servcul when required credentials are missing', async () => {
    const unconfiguredService = new ServculService(new ConfigService());

    await expect(
      unconfiguredService.addPlayerDeposit(76, { lng: 'ru', summa: 100 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not report success when Servcul returns success false', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, message: 'Rejected' }), { status: 200 }),
    );

    await expect(
      service.addPlayerDeposit(76, { lng: 'ru', summa: 100 }),
    ).rejects.toThrow("L'API Servcul n'a pas confirmé le crédit du joueur");
  });
});

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function md5(value: string): string {
  return createHash('md5').update(value).digest('hex');
}
