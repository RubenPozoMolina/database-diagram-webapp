import { describe, it, expect } from "vitest";
import { generateId, clamp } from "../utils/id";

describe("id utils", () => {
  it("generates unique ids", () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
    expect(typeof a).toBe("string");
  });

  it("clamps values within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(100, 0, 10)).toBe(10);
  });
});
