import { describe, expect, it } from 'vitest';
import { TrafficLogger } from '../src/lib/elm327/trafficLogger';

describe('ELM327 Traffic Logger & VIN Redaction', () => {
  it('records TX and RX traffic when enabled, ignores when disabled', () => {
    const logger = new TrafficLogger({ maxEntries: 10 });
    expect(logger.isEnabled()).toBe(false);

    logger.logTx('0100');
    logger.logRx('41 00 BE 3F B8 11');
    expect(logger.getEntries()).toHaveLength(0);

    logger.setEnabled(true);
    logger.logTx('0100');
    logger.logRx('41 00 BE 3F B8 11', 45);

    const entries = logger.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.direction).toBe('TX');
    expect(entries[0]?.content).toBe('0100');
    expect(entries[1]?.direction).toBe('RX');
    expect(entries[1]?.content).toBe('41 00 BE 3F B8 11');
    expect(entries[1]?.durationMs).toBe(45);
  });

  it('maintains fixed ring buffer capacity without memory growth', () => {
    const logger = new TrafficLogger({ maxEntries: 5 });
    logger.setEnabled(true);

    for (let i = 0; i < 15; i++) {
      logger.logTx(`CMD_${i}`);
    }

    const entries = logger.getEntries();
    expect(entries).toHaveLength(5);
    expect(entries[0]?.content).toBe('CMD_10');
    expect(entries[4]?.content).toBe('CMD_14');
  });

  it('redacts 17-character VINs by default in RX traffic', () => {
    const logger = new TrafficLogger({ redactVin: true });
    logger.setEnabled(true);

    const sampleVin = '1FA6P8CF9H1234567';
    logger.logRx(`VIN: ${sampleVin}`);

    const entries = logger.getEntries();
    expect(entries[0]?.content).not.toContain(sampleVin);
    expect(entries[0]?.content).toContain('[REDACTED_VIN]');
  });

  it('redacts Mode 09 PID 02 hex response lines', () => {
    const logger = new TrafficLogger({ redactVin: true });
    logger.setEnabled(true);

    logger.logRx('49 02 01 00 00 00 31');
    logger.logRx('49 02 02 4A 31 42 41 33');

    const entries = logger.getEntries();
    expect(entries[0]?.content).toBe('49 02 [REDACTED_VIN_DATA]');
    expect(entries[1]?.content).toBe('49 02 [REDACTED_VIN_DATA]');
  });

  it('exports formatted support log with metadata', () => {
    const logger = new TrafficLogger({ redactVin: true });
    logger.setEnabled(true);

    logger.logTx('ATZ');
    logger.logRx('ELM327 v1.5', 120);

    const exportText = logger.exportLog({
      appVersion: '1.0.0',
      adapterInfo: 'OBDLink SX USB',
    });

    expect(exportText).toContain('=== OBD DIAGNOSE - RAW ELM327 TRAFFIC LOG ===');
    expect(exportText).toContain('App Version: 1.0.0');
    expect(exportText).toContain('Adapter: OBDLink SX USB');
    expect(exportText).toContain('TX: ATZ');
    expect(exportText).toContain('RX (120ms): ELM327 v1.5');
  });
});
