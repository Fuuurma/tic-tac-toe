import type { Locale } from "@/lib/preferences";
import { en, type StringKey } from "./en";
import { es } from "./es";

const dictionaries: Record<Locale, Record<StringKey, string>> = { en, es };

let current: Locale = "en";
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

export function publishLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  for (const listener of [...listeners]) listener();
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type StringVars = Record<string, string | number>;

export function t(key: StringKey, vars?: StringVars): string {
  const template = dictionaries[current][key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
}
