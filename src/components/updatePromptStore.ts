import { useSyncExternalStore } from "react";

let updateAvailable = false;
let dismissed = false;
let gameActive = false;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => updateAvailable && !dismissed && !gameActive;

function emit(): void {
  for (const listener of [...listeners]) listener();
}

export function notifyUpdateAvailable(): void {
  dismissed = false;
  updateAvailable = true;
  emit();
}

export function dismissUpdatePrompt(): void {
  if (dismissed) return;
  dismissed = true;
  emit();
}

export function setUpdatePromptGameActive(active: boolean): void {
  if (gameActive === active) return;
  gameActive = active;
  emit();
}

export function resetUpdatePromptForTests(): void {
  updateAvailable = false;
  dismissed = false;
  gameActive = false;
  emit();
}

export function useUpdatePromptVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
