import { describe, it, expect } from "vitest";
import { generateId } from "../../frontend/src/utils/id";

describe("shared id util", () => {
  it("generates unique ids", () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
  });
});
