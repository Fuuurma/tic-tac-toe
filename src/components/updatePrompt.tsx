import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStrings } from "@/i18n/language";
import { requestUpdate } from "@/lib/serviceWorker";
import { dismissUpdatePrompt, useUpdatePromptVisible } from "./updatePromptStore";

export function UpdatePrompt() {
  const visible = useUpdatePromptVisible();
  const { t } = useStrings();
  if (!visible) return null;
  return (
    <div
      role="status"
      className="glass animate-pop-in fixed inset-x-4 bottom-[max(1rem,var(--inset-bottom))] z-40 mx-auto flex w-fit max-w-md flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 py-2.5"
    >
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
        <RefreshCw className="size-4 text-muted-foreground" aria-hidden="true" />
        {t("update.available")}
      </span>
      <Button size="sm" variant="glass" onClick={requestUpdate}>
        {t("update.reload")}
      </Button>
      <Button size="sm" variant="ghost" onClick={dismissUpdatePrompt}>
        {t("update.dismiss")}
      </Button>
    </div>
  );
}
