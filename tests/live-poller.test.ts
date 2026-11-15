import { describe, expect, it } from 'vitest';

import type { Elm327Driver } from '../src/lib/elm327/driver';
import { calculatePollDelayMs, LivePoller } from '../src/lib/obd/livePoller';
import type { PidReading } from '../src/lib/obd/pids';

class MockDriver {
  calls: string[] = [];

  send(command: string): Promise<{ lines: string[] }> {
    this.calls.push(command);

    if (command === '010C') {
      // RPM = (0x1A * 256 + 0xF8) / 4 = 1726
      return Promise.resolve({ lines: ['41 0C 1A F8'] });
    }
    if (command === '010D') {
      // Speed = 60 km/h (0x3C)
      return Promise.resolve({ lines: ['41 0D 3C'] });
    }
    if (command === '0105') {
      // Coolant = 0x5A - 40 = 50 C
      return Promise.resolve({ lines: ['41 05 5A'] });
    }
    if (command === '0104') {
      // Load = (0x80 * 100) / 255 = 50.2 %
      return Promise.resolve({ lines: ['41 04 80'] });
    }

    return Promise.resolve({ lines: ['NO DATA'] });
  }
}

describe('LivePoller smart scheduler and sequential polling', () => {
  it('calculates adaptive delay based on PID count', () => {
    expect(calculatePollDelayMs(1)).toBe(10);
    expect(calculatePollDelayMs(2)).toBe(10);
    expect(calculatePollDelayMs(3)).toBe(15);
    expect(calculatePollDelayMs(4)).toBe(15);
    expect(calculatePollDelayMs(6)).toBe(40);
    expect(calculatePollDelayMs(8)).toBe(40);
    expect(calculatePollDelayMs(12)).toBe(100);
  });

  it('polls PIDs sequentially and delivers decoded readings', async () => {
    const driver = new MockDriver();
    const readings: PidReading[] = [];

    const poller = new LivePoller(driver as unknown as Elm327Driver, {
      pids: [0x0c, 0x0d],
      onReading: (r) => readings.push(r),
    });

    poller.start();
    expect(poller.isRunning).toBe(true);

    // Let it run for a short cycle
    await new Promise((r) => setTimeout(r, 120));
    await poller.stop();

    expect(poller.isRunning).toBe(false);
    expect(readings.length).toBeGreaterThanOrEqual(2);

    const rpmReading = readings.find((r) => r.pid === 0x0c);
    expect(rpmReading?.measurements[0]?.unit).toBe('rpm');
    expect(rpmReading?.measurements[0]?.value).toBe(1726);

    const speedReading = readings.find((r) => r.pid === 0x0d);
    expect(speedReading?.measurements[0]?.unit).toBe('kmh');
    expect(speedReading?.measurements[0]?.value).toBe(60);
  });

  it('pauses and resumes without leaking polling cycles', async () => {
    const driver = new MockDriver();
    const readings: PidReading[] = [];

    const poller = new LivePoller(driver as unknown as Elm327Driver, {
      pids: [0x0c],
      onReading: (r) => readings.push(r),
    });

    poller.start();
    await new Promise((r) => setTimeout(r, 60));
    poller.pause();
    expect(poller.isPaused).toBe(true);
    expect(poller.isRunning).toBe(false);

    const countWhenPaused = readings.length;
    await new Promise((r) => setTimeout(r, 60));
    expect(readings.length).toBe(countWhenPaused);

    poller.resume();
    expect(poller.isRunning).toBe(true);
    await new Promise((r) => setTimeout(r, 100));
    expect(readings.length).toBeGreaterThan(countWhenPaused);

    await poller.stop();
  });
});
