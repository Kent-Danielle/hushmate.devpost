import { BadRequestException, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import webpush from 'web-push';
import { getConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SubscribeDto } from './dto/subscription.dto.js';
import { buildEnvelope, buildSendOptions, type PushMessage } from './push-payload.js';
import { endpointHost, isAllowedPushEndpoint } from './push-hosts.js';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    const config = getConfig();
    webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
  }

  getPublicKey(): string {
    return getConfig().vapidPublicKey;
  }

  /** Upsert by endpoint, reassigning the row to the caller (a shared phone follows whoever signed in last). */
  async subscribe(userId: string, dto: SubscribeDto): Promise<void> {
    if (!isAllowedPushEndpoint(dto.endpoint)) {
      throw new BadRequestException('Unsupported push endpoint');
    }
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: { userId, endpoint: dto.endpoint, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
      update: { userId, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
    });
  }

  /** Removes the caller's own row only. */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  /** Sends to every device of the user; each result is handled on its own. Never throws. */
  async sendToUser(userId: string, message: PushMessage): Promise<void> {
    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (subscriptions.length === 0) return;
    const body = JSON.stringify(buildEnvelope(message));
    const options = buildSendOptions(message.kind);

    await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        const host = endpointHost(subscription.endpoint);
        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            body,
            options,
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
          } else if (status === 400 || status === 401 || status === 403) {
            this.logger.error(`Push rejected with ${status} by ${host}: check the VAPID config (subscription kept)`);
          } else if (status === 413) {
            this.logger.error(`Push payload too large (413) at ${host}: this is a bug`);
          } else {
            this.logger.warn(`Push to ${host} failed (${status ?? 'network error'}); not retrying`);
          }
        }
      }),
    );
  }
}
