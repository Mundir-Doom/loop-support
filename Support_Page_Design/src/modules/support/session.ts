import { SupportSession } from "./types";

const STORAGE_KEY = "support-session";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadStoredSession(): SupportSession | undefined {
  if (!isBrowser()) return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as SupportSession;
    if (!parsed?.sessionId) {
      window.localStorage.removeItem(STORAGE_KEY);
      return undefined;
    }
    return parsed;
  } catch (error) {
    console.warn("Failed to load stored session", error);
    window.localStorage.removeItem(STORAGE_KEY);
    return undefined;
  }
}

export function persistSession(session: SupportSession) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn("Failed to persist support session", error);
  }
}

export function clearStoredSession() {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear support session", error);
  }
}
