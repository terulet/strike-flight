/**
 * Local telemetry sink (section 31). Logs structured events with timestamps.
 * Currently prints to console + keeps an in-memory buffer; swap `sink` later for a network sink.
 */
export interface TelemetryEvent {
  name: string;
  atMs: number;
  data?: Record<string, unknown>;
}

export class Telemetry {
  private buffer: TelemetryEvent[] = [];
  private startedAt = 0;
  enabled = true;

  start(nowMs: number): void {
    this.startedAt = nowMs;
    this.buffer = [];
  }

  log(name: string, data?: Record<string, unknown>, nowMs = this.startedAt): void {
    if (!this.enabled) return;
    const event: TelemetryEvent = { name, atMs: nowMs - this.startedAt, data };
    this.buffer.push(event);
    // eslint-disable-next-line no-console
    console.debug(`[telemetry] ${name}`, data ?? {});
  }

  getBuffer(): readonly TelemetryEvent[] {
    return this.buffer;
  }

  clear(): void {
    this.buffer = [];
  }
}
