"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle2, Download, XCircle } from "lucide-react";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function StudentClearancePage() {
  const [status, setStatus] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkClearance() {
      try {
        const data = await api.get<{ is_cleared: boolean }>("/me/clearance");
        setStatus(data.is_cleared);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Failed to load clearance status"));
      } finally {
        setIsLoading(false);
      }
    }
    checkClearance();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="surface-glass rounded-[2rem] p-6">
        <div className="mb-3 inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary">
          Graduation readiness
        </div>
        <h1 className="font-heading text-4xl tracking-[-0.05em]">Clearance Status</h1>
        <p className="mt-2 text-muted-foreground">Check if you have met all institutional requirements.</p>
      </div>

      <Card className="text-center py-12">
        <CardContent>
          <div className="flex justify-center mb-6">
            {status === true ? (
              <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] border border-emerald-500/25 bg-emerald-500/15 text-emerald-300">
                <CheckCircle2 className="h-12 w-12" />
              </div>
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] border border-red-500/25 bg-red-500/15 text-red-300">
                <XCircle className="h-12 w-12" />
              </div>
            )}
          </div>

          <h2 className="font-heading text-4xl tracking-[-0.04em]">
            {status ? "You are fully cleared!" : "Not Cleared"}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            {status
              ? "All your financial obligations have been settled. You can now proceed with your graduation or deferment processes."
              : "You have outstanding balances or missing requirements. Please check your fee statement to resolve these issues."}
          </p>

          {status && (
            <Button className="mt-8 h-11 gap-2 rounded-xl px-4" onClick={() => toast.info("Downloading clearance certificate...")}>
              <Download className="h-4 w-4" /> Download Clearance Certificate
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
