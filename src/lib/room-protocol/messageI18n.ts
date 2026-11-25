import { t } from "@/i18n/language";
import type { StringKey } from "@/i18n/en";
import type { StringVars } from "@/i18n/dictionary";
import type { PeerRoomMessage } from "./state";

export type MessageTextSource = {
  message?: string;
  messageKey?: StringKey | null;
  messageVars?: StringVars;
};

export const keyedMessage = (
  key: StringKey,
  vars?: StringVars,
): PeerRoomMessage => ({
  message: t(key, vars),
  messageKey: key,
  messageVars: vars,
});

export const clearedMessage = (): PeerRoomMessage => ({
  message: "",
  messageKey: null,
  messageVars: undefined,
});

export const statusMessageText = (value: MessageTextSource): string =>
  value.messageKey ? t(value.messageKey, value.messageVars) : value.message ?? "";
