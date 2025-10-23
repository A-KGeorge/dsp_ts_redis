/**
 * Unit tests for CircularLogBuffer
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { CircularLogBuffer } from "../CircularLogBuffer.js";
import type { LogEntry } from "../types.js";

describe("CircularLogBuffer", () => {
  it("should start empty", () => {
    const buffer = new CircularLogBuffer(4);
    assert.strictEqual(buffer.size(), 0);
    assert.strictEqual(buffer.hasEntries(), false);
    assert.deepStrictEqual(buffer.flush(), []);
  });

  it("should store and retrieve entries in order", () => {
    const buffer = new CircularLogBuffer(4);

    const entry1: LogEntry = {
      level: "info",
      message: "First",
      timestamp: 1,
    };
    const entry2: LogEntry = {
      level: "debug",
      message: "Second",
      timestamp: 2,
    };

    buffer.push(entry1);
    buffer.push(entry2);

    assert.strictEqual(buffer.size(), 2);
    assert.strictEqual(buffer.hasEntries(), true);

    const entries = buffer.flush();
    assert.strictEqual(entries.length, 2);
    assert.strictEqual(entries[0].message, "First");
    assert.strictEqual(entries[1].message, "Second");

    // Should be empty after flush
    assert.strictEqual(buffer.size(), 0);
    assert.strictEqual(buffer.hasEntries(), false);
  });

  it("should overwrite oldest entries when full", () => {
    const buffer = new CircularLogBuffer(3);

    buffer.push({ level: "info", message: "1", timestamp: 1 });
    buffer.push({ level: "info", message: "2", timestamp: 2 });
    buffer.push({ level: "info", message: "3", timestamp: 3 });
    buffer.push({ level: "info", message: "4", timestamp: 4 }); // Overwrites "1"
    buffer.push({ level: "info", message: "5", timestamp: 5 }); // Overwrites "2"

    const entries = buffer.flush();
    assert.strictEqual(entries.length, 3);
    assert.strictEqual(entries[0].message, "3"); // Oldest
    assert.strictEqual(entries[1].message, "4");
    assert.strictEqual(entries[2].message, "5"); // Newest
  });

  it("should handle wrap-around correctly", () => {
    const buffer = new CircularLogBuffer(4);

    // Fill buffer
    buffer.push({ level: "info", message: "A", timestamp: 1 });
    buffer.push({ level: "info", message: "B", timestamp: 2 });
    buffer.push({ level: "info", message: "C", timestamp: 3 });
    buffer.push({ level: "info", message: "D", timestamp: 4 });

    // Flush and refill
    buffer.flush();

    buffer.push({ level: "info", message: "E", timestamp: 5 });
    buffer.push({ level: "info", message: "F", timestamp: 6 });

    const entries = buffer.flush();
    assert.strictEqual(entries.length, 2);
    assert.strictEqual(entries[0].message, "E");
    assert.strictEqual(entries[1].message, "F");
  });

  it("should clear without allocating new memory", () => {
    const buffer = new CircularLogBuffer(4);

    buffer.push({ level: "info", message: "Test", timestamp: 1 });
    buffer.push({ level: "info", message: "Test", timestamp: 2 });

    assert.strictEqual(buffer.size(), 2);

    buffer.clear();

    assert.strictEqual(buffer.size(), 0);
    assert.strictEqual(buffer.hasEntries(), false);
    assert.deepStrictEqual(buffer.flush(), []);
  });

  it("should handle context in log entries", () => {
    const buffer = new CircularLogBuffer(4);

    buffer.push({
      level: "error",
      message: "Error occurred",
      context: { code: 500, path: "/api/test" },
      timestamp: 123,
    });

    const entries = buffer.flush();
    assert.strictEqual(entries[0].context?.code, 500);
    assert.strictEqual(entries[0].context?.path, "/api/test");
  });

  it("should maintain chronological order when full", () => {
    const buffer = new CircularLogBuffer(5);

    // Add 10 entries (buffer capacity is 5)
    for (let i = 1; i <= 10; i++) {
      buffer.push({
        level: "info",
        message: `Entry ${i}`,
        timestamp: i,
      });
    }

    const entries = buffer.flush();
    assert.strictEqual(entries.length, 5);

    // Should have entries 6-10 (oldest to newest)
    assert.strictEqual(entries[0].message, "Entry 6");
    assert.strictEqual(entries[1].message, "Entry 7");
    assert.strictEqual(entries[2].message, "Entry 8");
    assert.strictEqual(entries[3].message, "Entry 9");
    assert.strictEqual(entries[4].message, "Entry 10");
  });

  it("should support multiple flush cycles", () => {
    const buffer = new CircularLogBuffer(3);

    // Cycle 1
    buffer.push({ level: "info", message: "A", timestamp: 1 });
    buffer.push({ level: "info", message: "B", timestamp: 2 });
    let entries = buffer.flush();
    assert.strictEqual(entries.length, 2);
    assert.strictEqual(entries[0].message, "A");

    // Cycle 2
    buffer.push({ level: "info", message: "C", timestamp: 3 });
    entries = buffer.flush();
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].message, "C");

    // Cycle 3 (empty)
    entries = buffer.flush();
    assert.strictEqual(entries.length, 0);
  });
});
