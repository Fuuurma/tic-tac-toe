"use client";
import { AI_Difficulty } from "@/app/game/constants/constants";
import capitalizeFirstLetter from "@/app/utils/capitalize";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Info } from "lucide-react";

interface AI_DifficultySelectorProps {
  selectedDifficulty: AI_Difficulty;
  onDifficultyChange: (difficulty: AI_Difficulty) => void;
}

const AI_DifficultySelector: React.FC<AI_DifficultySelectorProps> = ({
  selectedDifficulty,
  onDifficultyChange,
}) => {
  return (
    <div className="space-y-2">
      {/* The Select component remains the same */}
      <Select
        value={selectedDifficulty}
        onValueChange={(value) => onDifficultyChange(value as AI_Difficulty)}
      >
        <SelectTrigger id="ai-difficulty" className="w-full md:w-[180px]">
          <SelectValue placeholder="Select difficulty" />
        </SelectTrigger>
        <SelectContent>
          {Object.values(AI_Difficulty).map((difficulty) => (
            <SelectItem key={difficulty} value={difficulty}>
              {capitalizeFirstLetter(difficulty)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default AI_DifficultySelector;
