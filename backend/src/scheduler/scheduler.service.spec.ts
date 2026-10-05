import { describe, expect, it, vi } from 'vitest';
import type { DemoService } from '../demo/demo.service.js';
import { SchedulerService } from './scheduler.service.js';

function make(): SchedulerService {
  return new SchedulerService({} as DemoService);
}

describe('SchedulerService.runExclusive', () => {
  it('never runs two jobs at once, in call order', async () => {
    const s = make();
    const log: string[] = [];
    const slow = s.runExclusive('a', async () => {
      log.push('a:start');
      await new Promise((r) => setTimeout(r, 20));
      log.push('a:end');
    });
    const fast = s.runExclusive('b', async () => void log.push('b'));
    await Promise.all([slow, fast]);
    expect(log).toEqual(['a:start', 'a:end', 'b']);
  });

  it('keeps going after a job throws', async () => {
    const s = make();
    await s.runExclusive('bad', () => Promise.reject(new Error('boom')));
    await expect(s.runExclusive('good', async () => 7)).resolves.toBe(7);
  });

  it('skips new work after shutdown starts and waits for the in-flight job', async () => {
    const s = make();
    const work = vi.fn();
    let finished = false;
    void s.runExclusive('inflight', async () => {
      await new Promise((r) => setTimeout(r, 20));
      finished = true;
    });
    await new Promise((r) => setTimeout(r, 5)); // let it start
    const destroying = s.onModuleDestroy();
    await s.runExclusive('late', async () => void work());
    await destroying;
    expect(finished).toBe(true);
    expect(work).not.toHaveBeenCalled();
  });
});
