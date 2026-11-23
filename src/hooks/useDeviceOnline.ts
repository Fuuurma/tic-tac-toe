import { useSyncExternalStore } from "react";

const readOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;

let attached = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of [...listeners]) listener();
}

function attach() {
  if (attached || typeof window === "undefined") return;
  attached = true;
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
}

function detach() {
  if (!attached) return;
  attached = false;
  window.removeEventListener("online", notify);
  window.removeEventListener("offline", notify);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1) attach();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) detach();
  };
};

const getSnapshot = () => readOnline();

export function useDeviceOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function resetDeviceOnlineStore(): void {
  detach();
  listeners.clear();
}
