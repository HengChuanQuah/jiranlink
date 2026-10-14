import { useSyncExternalStore } from "react";
import { buildSeed } from "../data/seed";
import type { AppState } from "../data/types";
import { expireHolds } from "./domain";

const KEY = "jiranlink-demo-v4";

function load(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    return parsed.version === 4 ? parsed : null;
  } catch {
    return null;
  }
}

function save(s: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: the demo still works for this session */
  }
}

let state: AppState = load() ?? buildSeed();
expireHolds(state);
let version = 0;
const listeners = new Set<() => void>();

function commit() {
  // New top-level identity so React memos that depend on the state recompute.
  state = { ...state };
  version++;
  save(state);
  listeners.forEach((l) => l());
}

export function getState() {
  return state;
}

export function useApp(): AppState {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
  );
  return state;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Runs a business action against the state, saves, and reports a friendly error instead of throwing. */
export function act<T>(fn: (s: AppState) => T): Result<T> {
  try {
    const value = fn(state);
    commit();
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function resetDemo() {
  state = buildSeed();
  commit();
}

// Re-check expired holds every minute while the app is open.
if (typeof window !== "undefined") {
  setInterval(() => {
    if (expireHolds(state)) commit();
  }, 60_000);
}

// ---------- Toasts ----------
export interface Toast {
  id: number;
  text: string;
  tone: "ok" | "error" | "info";
}
let toasts: Toast[] = [];
let toastVersion = 0;
const toastListeners = new Set<() => void>();
export function toast(text: string, tone: Toast["tone"] = "ok") {
  const id = Date.now() + Math.random();
  toasts = [...toasts.slice(-1), { id, text, tone }];
  toastVersion++;
  toastListeners.forEach((l) => l());
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    toastVersion++;
    toastListeners.forEach((l) => l());
  }, tone === "error" ? 5000 : 3200);
}
export function useToasts(): Toast[] {
  useSyncExternalStore(
    (cb) => {
      toastListeners.add(cb);
      return () => toastListeners.delete(cb);
    },
    () => toastVersion,
  );
  return toasts;
}

/** Shorthand: run an action, toast the error if any, return whether it worked. */
export function run<T>(fn: (s: AppState) => T, okText?: string): T | undefined {
  const r = act(fn);
  if (!r.ok) {
    toast(r.error, "error");
    return undefined;
  }
  if (okText) toast(okText);
  return r.value;
}

/** Like run(), but returns true/false so callers can react to success. */
export function attempt(fn: (s: AppState) => unknown, okText?: string): boolean {
  const r = act(fn);
  if (!r.ok) {
    toast(r.error, "error");
    return false;
  }
  if (okText) toast(okText);
  return true;
}
