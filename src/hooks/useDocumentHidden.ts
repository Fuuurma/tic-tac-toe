import { useSyncExternalStore } from "react";

const readHidden = () =>
  typeof document === "undefined" ? false : document.visibilityState === "hidden";

let attached = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of [...listeners]) listener();
}

function attach() {
  if (attached || typeof document === "undefined") return;
  attached = true;
  document.addEventListener("visibilitychange", notify);
}

function detach() {
  if (!attached) return;
  attached = false;
  document.removeEventListener("visibilitychange", notify);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1) attach();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) detach();
  };
};

const getSnapshot = () => readHidden();

export function useDocumentHidden(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function resetDocumentHiddenStore(): void {
  detach();
  listeners.clear();
}
