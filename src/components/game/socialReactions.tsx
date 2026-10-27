import { useEffect, useState } from "react";
import { getLocale } from "@/i18n/language";
import { REACTIONS, type Reaction } from "@/lib/social";

const copy = {
  en: { title: "Reactions", mute: "Mute reactions", unmute: "Unmute reactions", unavailable: "Reactions unavailable with this opponent", sent: "Sent", failed: "Could not send", labels: ["Hello!", "Good luck!", "Nice move!", "Wow!", "Oops!", "Thinking…", "Thanks!", "Good game!", "Well played!", "Rematch?"] },
  es: { title: "Reacciones", mute: "Silenciar reacciones", unmute: "Activar reacciones", unavailable: "Reacciones no disponibles con este rival", sent: "Enviado", failed: "No se pudo enviar", labels: ["¡Hola!", "¡Buena suerte!", "¡Buena jugada!", "¡Guau!", "¡Ups!", "Pensando…", "¡Gracias!", "¡Buena partida!", "¡Bien jugado!", "¿Revancha?"] },
} as const;
const icons = ["👋", "🍀", "👏", "😮", "😅", "🤔", "🙏", "🤝", "✨", "🔄"];
const KEY = "tic-tac-toe:social-muted";

export function SocialReactions({ ready, reaction, send }: { ready: boolean; reaction: { id: Reaction; at: number } | null; send: (id: Reaction) => boolean }) {
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } });
  const [notice, setNotice] = useState("");
  const [visible, setVisible] = useState(false);
  const labels = copy[getLocale()];
  useEffect(() => {
    if (!reaction || muted) return;
    const show = window.setTimeout(() => setVisible(true), 0);
    const hide = window.setTimeout(() => setVisible(false), 3500);
    return () => { window.clearTimeout(show); window.clearTimeout(hide); };
  }, [reaction, muted]);
  const index = reaction ? REACTIONS.indexOf(reaction.id) : -1;
  return <div className="relative z-10 flex items-center justify-end gap-2 px-3 max-sm:order-3">
    <span role="status" aria-live="polite" className="text-sm">{!muted && visible && index >= 0 ? `${icons[index]} ${labels.labels[index]}` : notice}</span>
    <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => { const next = !muted; setMuted(next); try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* storage unavailable */ } }} aria-pressed={muted}>{muted ? labels.unmute : labels.mute}</button>
    <details className="relative">
      <summary className="cursor-pointer rounded-lg border px-3 py-2 text-sm" aria-label={ready ? labels.title : labels.unavailable}>{labels.title}</summary>
      <div className="absolute right-0 z-50 grid max-h-64 w-48 gap-1 overflow-auto rounded-xl border bg-background p-2 shadow-lg">
        {REACTIONS.map((id, i) => <button key={id} type="button" disabled={!ready} className="rounded-md px-2 py-2 text-left text-sm hover:bg-muted disabled:opacity-50" onClick={() => { setNotice(send(id) ? labels.sent : labels.failed); }}>{icons[i]} {labels.labels[i]}</button>)}
        {!ready && <p className="p-2 text-xs">{labels.unavailable}</p>}
      </div>
    </details>
  </div>;
}
