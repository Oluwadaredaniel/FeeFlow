import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface FeeProgressBarProps {
  paid: number;
  due: number;
  className?: string;
}

export function FeeProgressBar({ paid, due, className }: FeeProgressBarProps) {
  const percentage = due === 0 ? 100 : Math.min(Math.round((paid / due) * 100), 100);
  const isComplete = percentage === 100;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex justify-between text-xs font-medium">
        <span className={isComplete ? "text-green-600" : "text-muted-foreground"}>
          {isComplete ? "Fully Paid" : `${percentage}% Paid`}
        </span>
        <span className="text-muted-foreground">{percentage}%</span>
      </div>
      <Progress value={percentage} className={cn("h-2", isComplete && "bg-green-100")} />
    </div>
  );
}
