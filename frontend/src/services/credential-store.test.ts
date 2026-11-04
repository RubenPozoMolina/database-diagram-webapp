import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  setCredentials,
  getCredentials,
  clearCredentials,
  hasCredentials,
} from "./credential-store";
import type { DbCredentials } from "../types/credentials";

const testCredentials: DbCredentials = {
  host: "localhost",
  port: 5432,
  database: "testdb",
  user: "testuser",
  password: "secret-password",
};

describe("credential store", () => {
  beforeEach(() => {
    clearCredentials();
    vi.restoreAllMocks();
  });

  it("stores credentials in memory only", () => {
    setCredentials(testCredentials);
    expect(getCredentials()).toEqual(testCredentials);
    expect(hasCredentials()).toBe(true);
  });

  it("returns null when no credentials are set", () => {
    expect(getCredentials()).toBeNull();
    expect(hasCredentials()).toBe(false);
  });

  it("clears credentials from memory", () => {
    setCredentials(testCredentials);
    expect(hasCredentials()).toBe(true);
    clearCredentials();
    expect(getCredentials()).toBeNull();
    expect(hasCredentials()).toBe(false);
  });

  it("never writes credentials to localStorage", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    setCredentials(testCredentials);
    expect(setItemSpy).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining(testCredentials.password)
    );
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it("never writes credentials to sessionStorage", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    setCredentials(testCredentials);
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it("does not expose credential fields through getCredentials beyond the stored object", () => {
    setCredentials(testCredentials);
    const retrieved = getCredentials();
    expect(retrieved?.host).toBe(testCredentials.host);
    expect(retrieved?.port).toBe(testCredentials.port);
    expect(retrieved?.database).toBe(testCredentials.database);
    expect(retrieved?.user).toBe(testCredentials.user);
    expect(retrieved?.password).toBe(testCredentials.password);
  });

  it("overwrites previous credentials when set again", () => {
    setCredentials(testCredentials);
    const newCredentials: DbCredentials = {
      host: "remote-host",
      port: 5433,
      database: "otherdb",
      user: "otheruser",
      password: "other-password",
    };
    setCredentials(newCredentials);
    expect(getCredentials()).toEqual(newCredentials);
    expect(getCredentials()?.host).not.toBe(testCredentials.host);
  });
});
