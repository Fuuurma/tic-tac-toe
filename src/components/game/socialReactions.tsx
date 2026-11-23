import { useEffect, useState } from "react";
import { useStrings } from "@/i18n/language";
import type { StringKey } from "@/i18n/en";
import { loadSocialMuted, REACTIONS, saveSocialMuted, type Reaction } from "@/lib/social";

const icons = ["👋", "🍀", "👏", "😮", "😅", "🤔", "🙏", "🤝", "✨", "🔄"];

export function SocialReactions({ ready, reaction, send }: { ready: boolean; reaction: { id: Reaction; at: number } | null; send: (id: Reaction) => boolean }) {
  const { t } = useStrings();
  const [muted, setMuted] = useState(loadSocialMuted);
  const [notice, setNotice] = useState("");
  const [visible, setVisible] = useState(false);
  const label = (id: Reaction) => t(`social.reaction.${id}` as StringKey);
  useEffect(() => {
    if (!reaction || muted) return;
    const show = window.setTimeout(() => setVisible(true), 0);
    const hide = window.setTimeout(() => setVisible(false), 3500);
    return () => { window.clearTimeout(show); window.clearTimeout(hide); };
  }, [reaction, muted]);
  const index = reaction ? REACTIONS.indexOf(reaction.id) : -1;
  // z-30: the picker's `absolute z-50` dropdown competes inside THIS
  // stacking context, so the row's own z-index is the layer the open menu
  // paints at. It must out-stack PlayersPanel's z-20 root (the panel was
  // swallowing the menu's clicks) and stay under the sheet overlays at
  // z-50.
  return <div className="relative z-30 flex items-center justify-end gap-2 px-3 max-sm:order-3">
    <span role="status" aria-live="polite" className="text-sm">{!muted && visible && index >= 0 ? `${icons[index]} ${label(REACTIONS[index])}` : notice}</span>
    <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => { const next = !muted; setMuted(next); saveSocialMuted(next); }} aria-pressed={muted}>{muted ? t("social.unmute") : t("social.mute")}</button>
    <details className="relative">
      <summary className="cursor-pointer rounded-lg border px-3 py-2 text-sm" aria-label={ready ? t("social.title") : t("social.unavailable")}>{t("social.title")}</summary>
      <div className="absolute right-0 z-50 grid max-h-64 w-48 gap-1 overflow-auto rounded-xl border bg-background p-2 shadow-lg">
        {REACTIONS.map((id, i) => <button key={id} type="button" disabled={!ready} className="rounded-md px-2 py-2 text-left text-sm hover:bg-muted disabled:opacity-50" onClick={() => { setNotice(send(id) ? t("social.sent") : t("social.failed")); }}>{icons[i]} {label(id)}</button>)}
        {!ready && <p className="p-2 text-xs">{t("social.unavailable")}</p>}
      </div>
    </details>
  </div>;
}
