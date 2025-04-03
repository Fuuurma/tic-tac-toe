import { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";

export default function HelpButton() {
  return (
    <div className="fixed bottom-4 right-4">
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
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
              How to Play Tic-Tac-Toe
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-gray-700 dark:text-gray-300 space-y-3">
            <p>
              🎯 **Goal**: Get three of your marks in a row (horizontal,
              vertical, or diagonal) before your opponent!
            </p>
            <p>
              🖱 **How to Play**: Click an empty cell to place your mark (X or
              O). The turn switches after each move.
            </p>
            <p>
              🔥 **Winning**: The first player to align three marks wins! If the
              board fills with no winner, it's a draw!
            </p>
            <p>
              💡 **Tip**: Block your opponent strategically and look for sneaky
              ways to align three!
            </p>
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
}
