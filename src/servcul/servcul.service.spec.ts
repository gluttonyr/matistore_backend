import { ConfigService } from '@nestjs/config';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
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

  it('signs a MELBET deposit with the MELBET keys and address, never the 1XBET ones', async () => {
    const melbet = new ServculService(new ConfigService({
      ...values,
      MELBET_HASH: 'melbet-hash',
      MELBET_CASHIER_PASS: '999',
      MELBET_CASHDESK_ID: '55',
      MELBET_API_BASE_URL: 'https://cashdesk.melbet.example/CashdeskBotAPI/',
    }));
    await melbet.addPlayerDeposit(76, { lng: 'ru', summa: 100 }, 'MELBET');

    const [url, request] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = request.headers as Record<string, string>;
    expect(url).toBe('https://cashdesk.melbet.example/CashdeskBotAPI/Deposit/76/Add');
    expect(headers.sign).toBe(sha256(`${sha256('hash=melbet-hash&lng=ru&userid=76')}${md5('summa=100&cashierpass=999&cashdeskid=55')}`));
    expect(JSON.parse(request.body as string)).toEqual({
      cashdeskId: 55,
      lng: 'ru',
      summa: 100,
      confirm: md5('76:melbet-hash'),
    });
  });

  it('refuses MELBET without its own keys and address, even when 1XBET is configured', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await expect(service.findPlayer(76, 'MELBET')).rejects.toThrow(
      'Configuration MELBET incomplète: renseignez MELBET_HASH, MELBET_CASHIER_PASS, MELBET_CASHDESK_ID et MELBET_API_BASE_URL',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
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
      new Response(JSON.stringify({
        success: false,
        message: 'Player not found',
        code: 'sensitive-upstream-code',
      }), { status: 200 }),
    );
    const loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await expect(
      service.addPlayerDeposit(76, { lng: 'ru', summa: 100 }),
    ).rejects.toThrow("L'API Servcul n'a pas confirmé le crédit du joueur");

    const logged = loggerSpy.mock.calls.map(([message]) => String(message)).join('\n');
    expect(logged).toContain('"event":"servcul.deposit.add.response-body"');
    expect(logged).toContain('Player not found');
    expect(logged).not.toContain('sensitive-upstream-code');
    loggerSpy.mockRestore();
  });
});

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function md5(value: string): string {
  return createHash('md5').update(value).digest('hex');
}
