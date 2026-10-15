import { useSyncExternalStore } from "react";

export type Route =
  | { name: "home" }
  | { name: "search"; q?: string; categoryIds?: string[] }
  | { name: "provider"; id: string; q?: string }
  | { name: "book"; serviceId: string; q?: string }
  | { name: "bookings"; tab?: string }
  | { name: "booking"; id: string }
  | { name: "messages" }
  | { name: "thread"; id: string }
  | { name: "requests"; draft?: string }
  | { name: "profile" }
  | { name: "signup" }
  | { name: "p-dashboard" }
  | { name: "p-services" }
  | { name: "p-availability" }
  | { name: "p-settings" }
  | { name: "p-reviews" }
  | { name: "admin"; tab?: string };

let stack: Route[] = [{ name: "home" }];
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  listeners.forEach((l) => l());
  if (typeof window !== "undefined") window.scrollTo({ top: 0 });
}

export function navigate(r: Route, opts: { replace?: boolean; reset?: boolean } = {}) {
  if (opts.reset) stack = [r];
  else if (opts.replace) stack = [...stack.slice(0, -1), r];
  else stack = [...stack, r].slice(-30);
  emit();
}

export function back(fallback: Route = { name: "home" }) {
  if (stack.length > 1) stack = stack.slice(0, -1);
  else stack = [fallback];
  emit();
}

export const canGoBack = () => stack.length > 1;

export function useRoute(): Route {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
  );
  return stack[stack.length - 1];
}
