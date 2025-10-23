/**
 * Circular buffer for efficient log pooling
 * Avoids array reallocations and maintains fixed memory footprint
 */

import type { LogEntry } from "./types.js";

export class CircularLogBuffer {
  private buffer: LogEntry[];
  private writeIndex = 0;
  private count = 0;
  private readonly capacity: number;

  /**
   * Create a circular log buffer
   * @param capacity - Maximum number of log entries to store (default: 32)
   */
  constructor(capacity: number = 32) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Add a log entry to the buffer
   * If buffer is full, oldest entry is overwritten
   */
  push(entry: LogEntry): void {
    this.buffer[this.writeIndex] = entry;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /**
   * Get all log entries in chronological order and clear the buffer
   * @returns Array of log entries (oldest to newest)
   */
  flush(): LogEntry[] {
    if (this.count === 0) {
      return [];
    }

    const result: LogEntry[] = new Array(this.count);

    if (this.count < this.capacity) {
      // Buffer not full - entries are at start
      for (let i = 0; i < this.count; i++) {
        result[i] = this.buffer[i];
      }
    } else {
      // Buffer full - need to unwrap circular order
      const oldestIndex = this.writeIndex; // Points to oldest (next to be overwritten)
      for (let i = 0; i < this.capacity; i++) {
        result[i] = this.buffer[(oldestIndex + i) % this.capacity];
      }
    }

    // Reset buffer state (reuse memory)
    this.count = 0;
    this.writeIndex = 0;

    return result;
  }

  /**
   * Check if buffer has any entries
   */
  hasEntries(): boolean {
    return this.count > 0;
  }

  /**
   * Get current number of entries in buffer
   */
  size(): number {
    return this.count;
  }

  /**
   * Clear all entries without allocating new memory
   */
  clear(): void {
    this.count = 0;
    this.writeIndex = 0;
  }
}
