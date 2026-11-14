import { describe, expect, it } from 'vitest';

import { VehicleIdentityCache } from '../src/lib/obd/vehicleIdentity';
import { createScriptedAdapter, fullScanScript, reply } from './helpers/obdScript';

describe('VehicleIdentityCache', () => {
  it('reads the VIN once per connection and reuses the same promise', async () => {
    const { transport, driver, log } = createScriptedAdapter(fullScanScript());
    await transport.open();
    const cache = new VehicleIdentityCache(driver);

    const [first, second] = await Promise.all([cache.load(), cache.load()]);
    const third = await cache.load();

    expect(first?.makeSlug).toBe('porsche');
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(log.filter((command) => command === '0902')).toHaveLength(1);
  });

  it('caches a failed VIN read as null without blocking anything', async () => {
    const { transport, driver, log } = createScriptedAdapter({
      ...fullScanScript(),
      '0902': reply('NO DATA'),
    });
    await transport.open();
    const cache = new VehicleIdentityCache(driver);

    await expect(cache.load()).resolves.toBeNull();
    await expect(cache.load()).resolves.toBeNull();
    expect(log.filter((command) => command === '0902')).toHaveLength(1);
  });
});
