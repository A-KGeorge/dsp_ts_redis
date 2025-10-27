/**
 * Circular buffer for efficient log pooling
 * Avoids array reallocations and maintains fixed memory footprint
 */
import type { LogEntry } from "./types.js";
export declare class CircularLogBuffer {
    private buffer;
    private writeIndex;
    private count;
    private readonly capacity;
    /**
     * Create a circular log buffer
     * @param capacity - Maximum number of log entries to store (default: 32)
     */
    constructor(capacity?: number);
    /**
     * Add a log entry to the buffer
     * If buffer is full, oldest entry is overwritten
     */
    push(entry: LogEntry): void;
    /**
     * Get all log entries in chronological order and clear the buffer
     * @returns Array of log entries (oldest to newest)
     */
    flush(): LogEntry[];
    /**
     * Check if buffer has any entries
     */
    hasEntries(): boolean;
    /**
     * Get current number of entries in buffer
     */
    size(): number;
    /**
     * Clear all entries without allocating new memory
     */
    clear(): void;
}
//# sourceMappingURL=CircularLogBuffer.d.ts.map