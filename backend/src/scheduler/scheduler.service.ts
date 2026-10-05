import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getConfig } from '../config.js';
import { DemoService } from '../demo/demo.service.js';

@Injectable()
export class SchedulerService implements OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private chain: Promise<unknown> = Promise.resolve();
  private shuttingDown = false;

  constructor(private readonly demo: DemoService) {}

  /** One in-process promise chain shared by every job, so no two jobs ever interleave. */
  runExclusive<T>(name: string, work: () => Promise<T>): Promise<T | undefined> {
    if (this.shuttingDown) return Promise.resolve(undefined);
    const run = this.chain.then(async () => {
      if (this.shuttingDown) return undefined;
      try {
        return await work();
      } catch (error) {
        this.logger.error(`${name} failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        return undefined;
      }
    });
    this.chain = run;
    return run;
  }

  @Cron('* * * * *', { name: 'minute', waitForCompletion: true })
  minute(): Promise<unknown> {
    return this.runExclusive('minute', async () => {
      await this.demo.resetIfOverdue();
    });
  }

  @Cron('*/10 * * * * *', { name: 'bots', waitForCompletion: true })
  bots(): Promise<unknown> {
    return this.runExclusive('bots', async () => {
      await this.demo.sendDueBotNudges();
      await this.demo.acknowledgeBotNudges();
    });
  }

  @Cron('0 3 * * *', { name: 'demoReset', timeZone: 'America/Vancouver', waitForCompletion: true })
  demoReset(): Promise<unknown> {
    return this.runExclusive('demoReset', async () => {
      if (await this.demo.reset()) this.logger.log('Demo house reset');
    });
  }

  @Cron('0 12 * * *', { name: 'heartbeat', timeZone: 'America/Vancouver', waitForCompletion: true })
  heartbeat(): Promise<unknown> {
    return this.runExclusive('heartbeat', () => this.demo.heartbeat());
  }

  /** Called from main.ts after app.listen(): the overdue-reset check and the heartbeat, once. */
  async runBootChecks(): Promise<void> {
    if (!getConfig().schedulerEnabled) return;
    await this.runExclusive('boot-reset', () => this.demo.resetIfOverdue());
    await this.heartbeat();
    this.logger.log('Scheduler running (minute, bots, demoReset, heartbeat)');
  }

  /** Stop new ticks at once, then wait for the one in flight. */
  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    await this.chain.catch(() => undefined);
  }
}
