import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

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

/** Search screens morph in (the search bar glides from the hero to the top) where the browser supports view transitions. */
function smoothEmit(from: Route, to: Route) {
  const doc = typeof document !== "undefined" ? (document as Document & { startViewTransition?: (cb: () => void) => unknown }) : null;
  const wanted = to.name === "search" || from.name === "search";
  const calm = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!doc?.startViewTransition || !wanted || calm) return emit();
  try {
    doc.startViewTransition(() => flushSync(emit));
  } catch {
    emit();
  }
}

export function navigate(r: Route, opts: { replace?: boolean; reset?: boolean } = {}) {
  const from = stack[stack.length - 1];
  if (opts.reset) stack = [r];
  else if (opts.replace) stack = [...stack.slice(0, -1), r];
  else stack = [...stack, r].slice(-30);
  smoothEmit(from, r);
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
