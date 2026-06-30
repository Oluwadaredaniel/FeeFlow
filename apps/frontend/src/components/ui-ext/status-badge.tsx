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
      <Badge variant="outline" className={cn(status ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200")}>
        {status ? "CLEARED" : "NOT CLEARED"}
      </Badge>
    );
  }

  const colors: Record<Status, string> = {
    PAID: "bg-green-100 text-green-700 border-green-200",
    RECONCILED: "bg-green-100 text-green-700 border-green-200",
    SUCCESS: "bg-green-100 text-green-700 border-green-200",
    CLEARED: "bg-green-100 text-green-700 border-green-200",
    APPROVED: "bg-green-100 text-green-700 border-green-200",
    PROCESSED: "bg-green-100 text-green-700 border-green-200",
    ACTIVE: "bg-green-100 text-green-700 border-green-200",

    PARTIALLY_PAID: "bg-amber-100 text-amber-700 border-amber-200",
    PENDING: "bg-amber-100 text-amber-700 border-amber-200",
    REQUESTED: "bg-amber-100 text-amber-700 border-amber-200",
    UNRECONCILED: "bg-amber-100 text-amber-700 border-amber-200",
    DEFERRED: "bg-amber-100 text-amber-700 border-amber-200",

    UNPAID: "bg-red-100 text-red-700 border-red-200",
    FAILED: "bg-red-100 text-red-700 border-red-200",
    REJECTED: "bg-red-100 text-red-700 border-red-200",
    "NOT CLEARED": "bg-red-100 text-red-700 border-red-200",
    DISPUTED: "bg-red-100 text-red-700 border-red-200",

    GRADUATED: "bg-blue-100 text-blue-700 border-blue-200",
    INACTIVE: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <Badge variant="outline" className={cn(colors[status])}>
      {status.replace("_", " ")}
    </Badge>
  );
}
