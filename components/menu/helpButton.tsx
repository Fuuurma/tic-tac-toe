import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  HelpCircle,
  Target,
  MousePointerClick,
  Flame,
  Clock,
  ArrowUpCircle,
  Eye,
  XCircle,
} from "lucide-react";

export default function HelpButton() {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="p-3 rounded-full shadow-lg bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            <HelpCircle className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-lg p-6 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
              How to Play
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-start gap-3">
              <Target className="mt-1 w-5 h-5 text-blue-500" />
              <div>
                <span className="font-semibold">Goal:</span> Get 3 of your
                pieces in a row (horizontal, vertical, or diagonal) before your
                opponent.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MousePointerClick className="mt-1 w-5 h-5 text-green-500" />
              <div>
                <span className="font-semibold">How to Play:</span> Click on a
                cell to place your piece. Turns alternate between players.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <ArrowUpCircle className="mt-1 w-5 h-5 text-purple-500" />
              <div>
                <span className="font-semibold">Max 3 Pieces:</span> Each player
                can only have 3 pieces on the board. When placing a 4th, the
                oldest one disappears with a visual cue.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Eye className="mt-1 w-5 h-5 text-yellow-500" />
              <div>
                <span className="font-semibold">Visual Cues:</span> The next
                piece to disappear wiggles before it's removed, helping you
                track your oldest piece.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="mt-1 w-5 h-5 text-red-500" />
              <div>
                <span className="font-semibold">Countdown:</span> Each turn has
                a timer. If you don't move in time, your turn is skipped.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Flame className="mt-1 w-5 h-5 text-orange-500" />
              <div>
                <span className="font-semibold">Winning:</span> First to get 3
                in a row wins. There are no ties!
              </div>
            </div>

            <div className="flex items-start gap-3">
              <XCircle className="mt-1 w-5 h-5 text-pink-500" />
              <div>
                <span className="font-semibold">No Draws:</span> Because of the
                3-piece limit, games can't end in a tie.
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
