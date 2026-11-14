import { ObdService, type CommandPort } from './obdService';
import type { VehicleIdentity } from './vinDecode';

/**
 * One VIN read per connection. The connection store warms this cache right
 * after a successful init, and the scan reuses the same promise instead of
 * asking the ECU again on every scan.
 */
export class VehicleIdentityCache {
  private readonly port: CommandPort;
  private identity: Promise<VehicleIdentity | null> | null = null;

  constructor(port: CommandPort) {
    this.port = port;
  }

  /** Resolves once per connection; failures are cached as `null`. */
  load(): Promise<VehicleIdentity | null> {
    this.identity ??= new ObdService(this.port).readVehicleIdentity();
    return this.identity;
  }
}
