"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Status =
  | "PAID" | "RECONCILED" | "SUCCESS" | "CLEARED" | "APPROVED" | "PROCESSED" // Green
  | "PARTIALLY_PAID" | "PENDING" | "REQUESTED" | "UNRECONCILED"             // Amber
  | "UNPAID" | "FAILED" | "REJECTED" | "NOT CLEARED" | "DISPUTED"           // Red
  | "ACTIVE"                                                               // Green
  | "DEFERRED"                                                             // Amber
  | "GRADUATED"                                                            // Blue
  | "INACTIVE";                                                            // Gray

interface StatusBadgeProps {
  status: Status | boolean;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (typeof status === "boolean") {
    return (
      <Badge variant="outline" className={cn(status ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" : "border-red-500/30 bg-red-500/15 text-red-300")}>
        {status ? "CLEARED" : "NOT CLEARED"}
      </Badge>
    );
  }

  const colors: Record<Status, string> = {
    PAID: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
    RECONCILED: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
    SUCCESS: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
    CLEARED: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
    APPROVED: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
    PROCESSED: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
    ACTIVE: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",

    PARTIALLY_PAID: "border-primary/30 bg-primary/15 text-primary",
    PENDING: "border-primary/30 bg-primary/15 text-primary",
    REQUESTED: "border-primary/30 bg-primary/15 text-primary",
    UNRECONCILED: "border-primary/30 bg-primary/15 text-primary",
    DEFERRED: "border-primary/30 bg-primary/15 text-primary",

    UNPAID: "border-red-500/30 bg-red-500/15 text-red-300",
    FAILED: "border-red-500/30 bg-red-500/15 text-red-300",
    REJECTED: "border-red-500/30 bg-red-500/15 text-red-300",
    "NOT CLEARED": "border-red-500/30 bg-red-500/15 text-red-300",
    DISPUTED: "border-red-500/30 bg-red-500/15 text-red-300",

    GRADUATED: "border-sky-500/30 bg-sky-500/15 text-sky-300",
    INACTIVE: "border-border bg-muted text-muted-foreground",
  };

  return (
    <Badge variant="outline" className={cn(colors[status])}>
      {status.replace("_", " ")}
    </Badge>
  );
}
