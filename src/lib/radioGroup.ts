import type { KeyboardEvent } from "react";

/**
 * Index the key should move to inside a radiogroup, wrapping around per the
 * ARIA radio-group keyboard pattern. Returns null for unrelated keys or when
 * focus is not on a radio child (index < 0).
 */
export function radioGroupKeyTarget(index: number, count: number, key: string): number | null {
  if (index < 0 || count <= 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (index + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (index + count - 1) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * Delegated keydown handler implementing the ARIA radio-group keyboard
 * contract: arrows and Home/End move focus to the sibling radio AND select it
 * (the click reuses the site's existing onChange path). Attach on the
 * role="radiogroup" element and give each role="radio" child
 * tabIndex={active ? 0 : -1} so the group is a single tab stop.
 */
export function handleRadioGroupKeyDown(event: KeyboardEvent<HTMLElement>) {
  const radios = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      '[role="radio"]:not(:disabled):not([aria-disabled="true"])',
    ),
  );
  const index = radios.findIndex(
    (el) => el === event.target || el.contains(event.target as Node),
  );
  const next = radioGroupKeyTarget(index, radios.length, event.key);
  if (next === null || next === index) return;
  event.preventDefault();
  radios[next].focus();
  radios[next].click();
}

/**
 * Delegated keydown handler implementing the ARIA tabs keyboard contract
 * with automatic activation: arrows and Home/End move focus to the sibling
 * tab AND select it (the click reuses the existing onTabChange path).
 * Attach on the role="tablist" element and give each role="tab" child
 * tabIndex={active ? 0 : -1} so the tablist is a single tab stop.
 * Shares radioGroupKeyTarget with the radiogroup handler (F236).
 */
export function handleTabListKeyDown(event: KeyboardEvent<HTMLElement>) {
  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      '[role="tab"]:not(:disabled):not([aria-disabled="true"])',
    ),
  );
  const index = tabs.findIndex(
    (el) => el === event.target || el.contains(event.target as Node),
  );
  const next = radioGroupKeyTarget(index, tabs.length, event.key);
  if (next === null || next === index) return;
  event.preventDefault();
  tabs[next].focus();
  tabs[next].click();
}
