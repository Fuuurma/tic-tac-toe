import { t, type StringVars } from "@/i18n/dictionary";
import type { StringKey } from "@/i18n/en";
import type { PeerRoomMessage, PeerStatusMessage } from "./state";

/**
 * How a room status line is written and read.
 *
 * Writers never store prose: they store the dictionary key plus vars via
 * `keyedMessage`/`clearedMessage`, and `message` is derived once at write
 * time for tests and non-React readers. The surface renders
 * `statusMessageText`, which re-translates the key in the CURRENT locale —
 * that is what lets a reconnecting/disconnected/waiting/error banner follow
 * a language switch instead of staying frozen in the locale active when the
 * status was written.
 */

/** The state fields for "show this status line". */
export function keyedMessage(key: StringKey, vars?: StringVars): PeerRoomMessage {
  return { messageKey: key, messageVars: vars, message: t(key, vars) };
}

/** The state fields for "no status line". */
export function clearedMessage(): PeerRoomMessage {
  return { messageKey: null, messageVars: undefined, message: "" };
}

/**
 * The status line's text in the current locale — what the UI renders.
 * A stored key re-translates on every call; states carrying prose without
 * a key (test fixtures, anything written before keys existed) fall back
 * to their write-time `message`.
 */
export function statusMessageText(
  message: Partial<PeerStatusMessage> & { message?: string },
): string {
  if (message.messageKey) return t(message.messageKey, message.messageVars);
  return message.message ?? "";
}
