import { useEffect, useState } from "react";
import { getLocale } from "@/i18n/language";
import { REACTIONS, REACTION_ICONS, REACTION_LABELS, type Reaction } from "@/lib/social";

const copy = {
  en: { title: "Reactions", mute: "Mute reactions", unmute: "Unmute reactions", unavailable: "Reactions available when connected", sent: "Sent", failed: "Could not send" },
  es: { title: "Reacciones", mute: "Silenciar reacciones", unmute: "Activar reacciones", unavailable: "Reacciones disponibles al conectar", sent: "Enviado", failed: "No se pudo enviar" },
} as const;
const KEY = "tic-tac-toe:social-muted";

export function SocialReactions({ ready, reaction, send }: { ready: boolean; reaction: { id: Reaction; at: number } | null; send: (id: Reaction) => boolean }) {
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } });
  const [notice, setNotice] = useState("");
  const [visible, setVisible] = useState(false);
  const locale = getLocale();
  const strings = copy[locale];
  const labels = REACTION_LABELS[locale];
  useEffect(() => {
    if (!reaction || muted) return;
    const show = window.setTimeout(() => setVisible(true), 0);
    const hide = window.setTimeout(() => setVisible(false), 3500);
    return () => { window.clearTimeout(show); window.clearTimeout(hide); };
  }, [reaction, muted]);
  // z-30: the picker's `absolute z-50` dropdown competes inside THIS
  // stacking context, so the row's own z-index is the layer the open menu
  // paints at. It must out-stack PlayersPanel's z-20 root (the panel was
  // swallowing the menu's clicks) and stay under the sheet overlays at
  // z-50.
  return <div className="relative z-30 flex items-center justify-end gap-2 px-3 max-sm:order-3">
    <span role="status" aria-live="polite" className="text-sm">{!muted && visible && reaction ? `${REACTION_ICONS[reaction.id]} ${labels[reaction.id]}` : notice}</span>
    <button type="button" className="rounded-lg border px-3 py-2 text-sm max-sm:min-h-11" onClick={() => { const next = !muted; setMuted(next); try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* storage unavailable */ } }} aria-pressed={muted}>{muted ? strings.unmute : strings.mute}</button>
    <details className="relative">
      <summary className="inline-flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm max-sm:min-h-11" aria-label={ready ? strings.title : strings.unavailable}>{strings.title}</summary>
      <div className="absolute right-0 z-50 grid max-h-64 w-48 gap-1 overflow-auto rounded-xl border bg-background p-2 shadow-lg">
        {REACTIONS.map((id) => <button key={id} type="button" disabled={!ready} className="rounded-md px-2 py-2 text-left text-sm hover:bg-muted disabled:opacity-50 max-sm:min-h-11" onClick={() => { setNotice(send(id) ? strings.sent : strings.failed); }}>{REACTION_ICONS[id]} {labels[id]}</button>)}
        {!ready && <p className="p-2 text-xs">{strings.unavailable}</p>}
      </div>
    </details>
  </div>;
}
