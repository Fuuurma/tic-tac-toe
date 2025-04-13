import React from "react";

const AI_DifficultySelectorInfo = () => {
  return (
    <div className="flex items-center gap-2">
      {" "}
      {/* Wrap label and button */}
      <Label htmlFor="ai-difficulty">AI Difficulty</Label>
      {/* Dialog Trigger Button */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
            {" "}
            {/* Small ghost button */}
            <Info className="h-4 w-4 text-muted-foreground" /> {/* Info Icon */}
            <span className="sr-only">About AI Difficulties</span>{" "}
            {/* Accessibility */}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          {" "}
          {/* Adjust width */}
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
                good moves. Provides a balanced challenge. (Uses MCTS)
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
                Difficult to beat, requires strategy. (Uses MCTS with more time)
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
                possible move every time. Very challenging! (Uses Minimax)
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AI_DifficultySelectorInfo;
