import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import capitalizeFirstLetter from "@/app/utils/capitalize";
import { AI_Difficulty } from "@/app/game/constants/constants";
const AI_DifficultySelectorInfo = () => {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="ai-difficulty">AI Difficulty</Label>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
            <Info className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">About AI Difficulties</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>AI Difficulty Levels</DialogTitle>
            <DialogDescription>
              Choose how challenging you want the computer opponent to be.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 text-sm">
            {/* Easy */}
            <div className="flex flex-col gap-1">
              <p>
                <span className="font-semibold">
                  {capitalizeFirstLetter(AI_Difficulty.EASY)}:
                </span>
              </p>
              <p className="text-muted-foreground">
                Uses simple rules. Good for learning the basics, but predictable
                and makes mistakes.
              </p>
            </div>
            {/* Normal */}
            <div className="flex flex-col gap-1">
              <p>
                <span className="font-semibold">
                  {capitalizeFirstLetter(AI_Difficulty.NORMAL)}:
                </span>
              </p>
              <p className="text-muted-foreground">
                Smarter opponent. Simulates many possible game outcomes to find
                good moves. Provides a balanced challenge.
                <br />
                Uses Monte Carlo Tree Search Algorithm
              </p>
            </div>
            {/* Hard */}
            <div className="flex flex-col gap-1">
              <p>
                <span className="font-semibold">
                  {capitalizeFirstLetter(AI_Difficulty.HARD)}:
                </span>
              </p>
              <p className="text-muted-foreground">
                Thinks much harder by simulating even more game outcomes.
                Difficult to beat, requires strategy.
                <br />
                Uses Monte Carlo Tree Search Algorithm
              </p>
            </div>
            {/* Insane */}
            <div className="flex flex-col gap-1">
              <p>
                <span className="font-semibold">
                  {capitalizeFirstLetter(AI_Difficulty.INSANE)}:
                </span>
              </p>
              <p className="text-muted-foreground">
                Plays optimally. Analyzes the game deeply to find the best
                possible move every time. Very challenging!
                <br />
                Uses MiniMax Algorithm
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AI_DifficultySelectorInfo;
