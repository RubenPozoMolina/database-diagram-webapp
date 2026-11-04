// Session-only credential storage.
// Holds database credentials in memory only for the current session.
// Never writes to localStorage, sessionStorage, or disk.
// Credentials are cleared when the page is refreshed or closed.

import type { DbCredentials } from "../types/credentials";

let credentials: DbCredentials | null = null;

/**
 * Store database credentials in memory for the current session.
 * Does not persist to any storage mechanism.
 */
export function setCredentials(creds: DbCredentials): void {
  credentials = creds;
}

/**
 * Retrieve the currently stored database credentials.
 * Returns null if no credentials have been set for this session.
 */
export function getCredentials(): DbCredentials | null {
  return credentials;
}

/**
 * Clear database credentials from memory.
 * Called on disconnect and on page unload to ensure credentials
 * do not survive beyond the current session.
 */
export function clearCredentials(): void {
  credentials = null;
}

/**
 * Returns true if credentials are currently held in memory.
 */
export function hasCredentials(): boolean {
  return credentials !== null;
}

// Clear credentials when the session ends (page refresh, close, or navigation away).
// This ensures credentials never survive beyond the current browser session.
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("beforeunload", () => {
    clearCredentials();
  });
}
