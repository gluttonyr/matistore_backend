import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { AddPlayerDepositDto } from './dto/add-player-deposit.dto';

export interface ServculPlayer {
  currencyId: number;
  userId: number;
  name: string;
}

export interface ServculDepositResult {
  summa: number | null;
  success: true;
  messageId: number | null;
  message: string;
}

export interface ServculPayoutDto {
  lng: string;
  code: string;
}

type ServculConfig = {
  baseUrl: string;
  hash: string;
  cashierPass: string;
  cashdeskId: string;
};

@Injectable()
export class ServculService {
  private readonly logger = new Logger(ServculService.name);
  private readonly defaultBaseUrl = 'https://partners.servcul.com/CashdeskBotAPI';

  constructor(private readonly config: ConfigService) {}

  async addPlayerDeposit(userId: number, body: AddPlayerDepositDto): Promise<ServculDepositResult> {
    const config = this.getConfig();
    const sign = this.createOperationSignature(
      config,
      body.lng,
      userId,
      `summa=${body.summa}&cashierpass=${config.cashierPass}&cashdeskid=${config.cashdeskId}`,
    );

    const result = await this.request(
      config,
      `Deposit/${userId}/Add`,
      {
        method: 'POST',
        headers: { sign },
        body: JSON.stringify({
          cashdeskId: Number(config.cashdeskId),
          lng: body.lng,
          summa: body.summa,
          confirm: this.confirm(userId, config.hash),
        }),
      },
      false,
      'deposit.add',
    );
    const normalized = this.normalizeServculResult(result);
    if (!normalized) {
      throw new BadGatewayException({
        message: "L'API Servcul n'a pas confirmé le crédit du joueur",
        upstreamResponse: result,
      });
    }
    return normalized;
  }

  async payoutPlayer(userId: number, body: ServculPayoutDto): Promise<ServculDepositResult> {
    const config = this.getConfig();
    const code = body.code.trim();
    if (!code) throw new BadGatewayException('Le code de retrait est requis');
    const sign = this.createOperationSignature(
      config,
      body.lng,
      userId,
      `code=${code}&cashierpass=${config.cashierPass}&cashdeskid=${config.cashdeskId}`,
    );

    const result = await this.request(config, `Deposit/${userId}/Payout`, {
      method: 'POST',
      headers: { sign },
      body: JSON.stringify({
        cashdeskId: Number(config.cashdeskId),
        lng: body.lng,
        code,
        confirm: this.confirm(userId, config.hash),
      }),
    }, false, 'deposit.payout');
    const normalized = this.normalizeServculResult(result);
    if (!normalized) {
      throw new BadGatewayException({
        message: "L'API Servcul n'a pas confirmé le retrait du joueur",
        upstreamResponse: result,
      });
    }
    return normalized;
  }

  async findPlayer(userId: number): Promise<ServculPlayer | null> {
    const config = this.getConfig();
    this.logger.log(JSON.stringify({
      event: 'servcul.player.lookup.started',
      userId,
      cashdeskId: config.cashdeskId,
      endpoint: this.diagnosticEndpoint(config, `Users/${userId}`),
    }));
    const signaturePartOne = this.sha256(
      `hash=${config.hash}&userid=${userId}&cashdeskid=${config.cashdeskId}`,
    );
    const signaturePartTwo = this.md5(
      `userid=${userId}&cashierpass=${config.cashierPass}&hash=${config.hash}`,
    );
    const sign = this.sha256(`${signaturePartOne}${signaturePartTwo}`);
    const query = new URLSearchParams({
      confirm: this.confirm(userId, config.hash),
      cashdeskId: config.cashdeskId,
    });

    const player = await this.request(config, `Users/${userId}?${query}`, {
      method: 'GET',
      headers: { sign },
    }, true, 'player.lookup');
    if (!player || typeof player !== 'object') {
      this.logger.warn(JSON.stringify({
        event: 'servcul.player.lookup.not-found',
        userId,
        responseType: player === null ? 'null' : typeof player,
        reason: 'Servcul a renvoyé une réponse vide ou un ID inexistant.',
      }));
      return null;
    }
    const result = player as Record<string, unknown>;
    // Servcul currently returns PascalCase keys (UserId, Name, CurrencyId),
    // while some environments return camelCase. Accept both wire formats.
    const returnedUserIdValue = result.userId ?? result.UserId;
    const returnedName = result.name ?? result.Name;
    const currencyIdValue = result.currencyId ?? result.CurrencyId;
    const returnedUserId = Number(returnedUserIdValue);
    const currencyId = Number(currencyIdValue);
    this.logger.log(JSON.stringify({
      event: 'servcul.player.lookup.response',
      requestedUserId: userId,
      returnedUserId: returnedUserIdValue ?? null,
      name: typeof returnedName === 'string' ? returnedName : null,
      currencyId: currencyIdValue ?? null,
      responseKeys: Object.keys(result),
    }));
    if (
      returnedUserId !== userId
      || typeof returnedName !== 'string'
      || !returnedName.trim()
    ) {
      this.logger.warn(JSON.stringify({
        event: 'servcul.player.lookup.invalid-response',
        requestedUserId: userId,
        returnedUserId: Number.isFinite(returnedUserId) ? returnedUserId : null,
        namePresent: typeof returnedName === 'string' && !!returnedName.trim(),
        responseKeys: Object.keys(result),
      }));
      return null;
    }
    return {
      userId: returnedUserId,
      currencyId: Number.isFinite(currencyId) ? currencyId : 0,
      name: returnedName.trim(),
    };
  }

  private normalizeServculResult(value: unknown): ServculDepositResult | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    const result = value as Record<string, unknown>;
    const success = result.success ?? result.Success;
    if (success !== true) return null;

    const rawSumma = result.summa ?? result.Summa;
    const rawMessageId = result.messageId ?? result.MessageId;
    const rawMessage = result.message ?? result.Message;
    const summa = rawSumma == null ? null : Number(rawSumma);
    const messageId = rawMessageId == null ? null : Number(rawMessageId);

    return {
      summa: summa !== null && Number.isFinite(summa) ? summa : null,
      success: true,
      messageId: messageId !== null && Number.isFinite(messageId) ? messageId : null,
      message: typeof rawMessage === 'string' ? rawMessage : '',
    };
  }

  private getConfig(): ServculConfig {
    const hash = this.config.get<string>('SERVCUL_HASH')?.trim();
    const cashierPass = this.config.get<string>('SERVCUL_CASHIER_PASS')?.trim();
    const cashdeskId = this.config.get<string>('SERVCUL_CASHDESK_ID')?.trim();
    const baseUrl =
      this.config.get<string>('SERVCUL_API_BASE_URL')?.trim() || this.defaultBaseUrl;

    if (!hash || !cashierPass || !cashdeskId) {
      throw new ServiceUnavailableException(
        'Configuration Servcul incomplète: renseignez SERVCUL_HASH, SERVCUL_CASHIER_PASS et SERVCUL_CASHDESK_ID dans le .env du backend',
      );
    }
    if (!/^\d+$/.test(cashdeskId)) {
      throw new ServiceUnavailableException('SERVCUL_CASHDESK_ID doit être un entier positif');
    }

    return {
      baseUrl: baseUrl.replace(/\/+$/, ''),
      hash,
      cashierPass,
      cashdeskId,
    };
  }

  private createOperationSignature(
    config: ServculConfig,
    lng: string,
    userId: number,
    operationParameters: string,
  ): string {
    const signaturePartOne = this.sha256(
      `hash=${config.hash}&lng=${lng}&userid=${userId}`,
    );
    const signaturePartTwo = this.md5(operationParameters);
    return this.sha256(`${signaturePartOne}${signaturePartTwo}`);
  }

  private confirm(id: string | number, hash: string): string {
    return this.md5(`${id}:${hash}`);
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private md5(value: string): string {
    return createHash('md5').update(value).digest('hex');
  }

  private async request(
    config: ServculConfig,
    path: string,
    init: RequestInit,
    notFoundAsNull = false,
    diagnosticEvent?: string,
  ): Promise<unknown> {
    const timeout = Number(this.config.get<string>('SERVCUL_API_TIMEOUT_MS') || 15_000);
    let response: Response;

    try {
      response = await fetch(`${config.baseUrl}/${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
        signal: AbortSignal.timeout(timeout),
      });
    } catch (error) {
      if (diagnosticEvent) {
        this.logger.error(JSON.stringify({
          event: `servcul.${diagnosticEvent}.network-error`,
          endpoint: this.diagnosticEndpoint(config, path),
          errorName: error instanceof Error ? error.name : typeof error,
        }));
      }
      throw new BadGatewayException("Impossible de joindre l'API Servcul");
    }

    const responseText = await response.text();
    if (diagnosticEvent) {
      this.logger.log(JSON.stringify({
        event: `servcul.${diagnosticEvent}.http-response`,
        endpoint: this.diagnosticEndpoint(config, path),
        status: response.status,
        contentType: response.headers.get('content-type'),
      }));
    }
    if (notFoundAsNull && response.status === 404) return null;
    let data: unknown;
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      if (diagnosticEvent) {
        this.logger.warn(JSON.stringify({
          event: `servcul.${diagnosticEvent}.non-json-response`,
          endpoint: this.diagnosticEndpoint(config, path),
          status: response.status,
          responsePreview: responseText.slice(0, 1000)
            .replace(/(["']?(?:confirm|sign|hash|cashierpass|token)["']?\s*[:=]\s*["']?)([^,&\s}"']+)/gi, '$1[REDACTED]'),
        }));
      }
      throw new BadGatewayException({
        message: "L'API Servcul a retourné une réponse non JSON",
        upstreamStatus: response.status,
      });
    }

    if (diagnosticEvent) {
      this.logger.log(JSON.stringify({
        event: `servcul.${diagnosticEvent}.response-body`,
        endpoint: this.diagnosticEndpoint(config, path),
        status: response.status,
        body: this.sanitizeDiagnostic(data),
      }));
    }

    if (!response.ok) {
      throw new BadGatewayException({
        message: "L'API Servcul a refusé la requête",
        upstreamStatus: response.status,
        upstreamResponse: data,
      });
    }

    return data;
  }

  private sanitizeDiagnostic(value: unknown): unknown {
    if (Array.isArray(value)) return value.slice(0, 10).map((item) => this.sanitizeDiagnostic(item));
    if (!value || typeof value !== 'object') {
      return typeof value === 'string' ? value.slice(0, 1000) : value;
    }
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (/sign|confirm|hash|pass|token|secret|authorization|code/i.test(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = this.sanitizeDiagnostic(item);
      }
    }
    return result;
  }

  private diagnosticEndpoint(config: ServculConfig, path: string): string {
    try {
      return `${new URL(config.baseUrl).origin}/${path.split('?')[0]}`;
    } catch {
      return path.split('?')[0];
    }
  }
}
