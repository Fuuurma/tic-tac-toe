import { useSyncExternalStore } from "react";

let updateAvailable = false;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => updateAvailable;

export function notifyUpdateAvailable(): void {
  if (updateAvailable) return;
  updateAvailable = true;
  for (const listener of [...listeners]) listener();
}

export function resetUpdatePromptForTests(): void {
  updateAvailable = false;
  for (const listener of [...listeners]) listener();
}

export function useUpdatePromptAvailable(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
