import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminCaptureDevice } from './entities/admin-capture-device.entity';
import { AdminCaptureState } from './entities/admin-capture-state.entity';
import { Transaction, TransactionStatus, TransactionType } from './entities/transaction.entity';
import { PushNotificationService } from '../notifications/push-notification.service';
import { UtilisateurService } from '../utilisateur/utilisateur.service';
import { ParametreService } from '../parametre/parametre.service';
import { PARAMETRE_CODES } from '../parametre/parametre.constants';

const HEARTBEAT_STALE_MS = 3 * 60_000;
const REMINDER_INTERVAL_MS = 15 * 60_000;
const REMINDER_POLL_MS = 60_000;

@Injectable()
export class AdminCaptureAvailabilityService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminCaptureAvailabilityService.name);
  private pollHandle?: ReturnType<typeof setInterval>;
  private pollRunning = false;

  constructor(
    @InjectRepository(AdminCaptureDevice) private readonly devices: Repository<AdminCaptureDevice>,
    @InjectRepository(AdminCaptureState) private readonly states: Repository<AdminCaptureState>,
    @InjectRepository(Transaction) private readonly transactions: Repository<Transaction>,
    private readonly push: PushNotificationService,
    private readonly users: UtilisateurService,
    private readonly parametres: ParametreService,
  ) {}

  async depositsClosed(): Promise<boolean> {
    return Number(await this.parametres.getValue(PARAMETRE_CODES.DEPOTS_FERMES)) === 1;
  }

  setDepositsClosed(closed: boolean) {
    return this.parametres.update(PARAMETRE_CODES.DEPOTS_FERMES, { valeur: closed ? 1 : 0 });
  }

  onModuleInit() {
    this.pollHandle = setInterval(() => {
      if (this.pollRunning) return;
      this.pollRunning = true;
      void this.getStatus()
        .then((status) => status.available ? undefined : this.sendOutageReminderIfDue())
        .catch((error) => this.logger.error('Échec du contrôle de disponibilité de la capture', error))
        .finally(() => { this.pollRunning = false; });
    }, REMINDER_POLL_MS);
    this.pollHandle.unref?.();
    void this.getStatus().catch((error) => this.logger.error('Initialisation de l’état de capture impossible', error));
  }

  onModuleDestroy() {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  async heartbeat(adminId: number, deviceId: string, ready: boolean, reason?: string) {
    const device = await this.devices.findOne({ where: { adminId, deviceId } });
    if (device) {
      const heartbeatWasStale = Date.now() - device.lastHeartbeatAt.getTime() > HEARTBEAT_STALE_MS;
      device.lastHeartbeatAt = new Date();
      device.consecutiveHealthySignals = ready
        ? heartbeatWasStale ? 1 : Math.min(device.consecutiveHealthySignals + 1, 2)
        : 0;
      device.failureReason = ready ? null : (reason ?? 'capture_not_configured');
      await this.devices.save(device);
    } else {
      await this.devices.save(this.devices.create({
        adminId,
        deviceId,
        lastHeartbeatAt: new Date(),
        consecutiveHealthySignals: ready ? 1 : 0,
        failureReason: ready ? null : (reason ?? 'capture_not_configured'),
      }));
    }
    return this.getStatus();
  }

  async setManualOverride(enabled: boolean) {
    const state = await this.getState();
    state.manualOverride = enabled;
    await this.states.save(state);
    return this.getStatus();
  }

  async getStatus() {
    const state = await this.getState();
    const now = Date.now();
    const recentDevices = await this.devices.find({
      where: { consecutiveHealthySignals: 2 },
      order: { lastHeartbeatAt: 'DESC' },
    });
    const activeDevice = recentDevices.find((device) => now - device.lastHeartbeatAt.getTime() <= HEARTBEAT_STALE_MS);
    const deviceAvailable = !!activeDevice;
    const effectiveAvailable = deviceAvailable || state.manualOverride;
    let stateChanged = false;

    if (!deviceAvailable && !state.outageStartedAt) {
      state.outageStartedAt = new Date(now);
      state.lastReminderAt = null;
      stateChanged = true;
      await this.transactions.createQueryBuilder()
        .update(Transaction)
        .set({ captureReconciliationRequired: true })
        .where('type = :type', { type: TransactionType.DEPOT })
        .andWhere('statut IN (:...statuses)', {
          statuses: [TransactionStatus.EN_ATTENTE_AUTO, TransactionStatus.EN_VERIFICATION, TransactionStatus.EN_ATTENTE_PREUVE],
        })
        .andWhere('"referencePaiement" IS NULL')
        .execute();
    } else if (deviceAvailable && state.outageStartedAt) {
      state.pausedExpirationMs = String(Number(state.pausedExpirationMs || 0) + Math.max(0, now - state.outageStartedAt.getTime()));
      state.outageStartedAt = null;
      state.lastReminderAt = null;
      stateChanged = true;
    }
    if (state.lastReportedAvailable !== deviceAvailable) {
      state.lastReportedAvailable = deviceAvailable;
      stateChanged = true;
    }
    if (stateChanged) await this.states.save(state);

    const recentFailure = await this.devices.find({ order: { lastHeartbeatAt: 'DESC' }, take: 1 });
    const failureReason = activeDevice
      ? null
      : recentFailure[0]?.failureReason ?? 'silent';
    // The admin switch wins over everything: clients see deposits unavailable.
    const depositsClosed = await this.depositsClosed();
    return {
      available: effectiveAvailable && !depositsClosed,
      depositsClosed,
      deviceAvailable,
      manualOverride: state.manualOverride,
      reason: depositsClosed ? 'deposits_closed' : state.manualOverride && !deviceAvailable ? 'manual_override' : failureReason,
      lastHeartbeatAt: activeDevice?.lastHeartbeatAt ?? recentFailure[0]?.lastHeartbeatAt ?? null,
      consecutiveHealthySignalsRequired: 2,
      heartbeatIntervalSeconds: 60,
      staleAfterSeconds: HEARTBEAT_STALE_MS / 1000,
      reminderIntervalMinutes: REMINDER_INTERVAL_MS / 60_000,
    };
  }

  async getPausedExpirationMs() {
    const state = await this.getState();
    return Number(state.pausedExpirationMs || 0)
      + (state.outageStartedAt ? Math.max(0, Date.now() - state.outageStartedAt.getTime()) : 0);
  }

  private async getState() {
    const existing = await this.states.findOne({ where: { id: 1 } });
    if (existing) return existing;
    await this.states.createQueryBuilder()
      .insert()
      .values({ id: 1 })
      .orIgnore()
      .execute();
    return this.states.findOneOrFail({ where: { id: 1 } });
  }

  private async sendOutageReminderIfDue() {
    const state = await this.getState();
    if (state.manualOverride) return;
    const now = Date.now();
    if (state.lastReminderAt && now - state.lastReminderAt.getTime() < REMINDER_INTERVAL_MS) return;
    const tokens = await this.users.getAdminPushTokens();
    if (tokens.length) {
      await this.push.sendToTokens(
        tokens,
        'Capture des paiements indisponible',
        'Ouvrez MatiStore sur le téléphone admin et rétablissez la capture des notifications pour accepter de nouveaux dépôts.',
        { type: 'ADMIN_CAPTURE_UNAVAILABLE' },
      );
    }
    state.lastReminderAt = new Date(now);
    await this.states.save(state);
  }
}
