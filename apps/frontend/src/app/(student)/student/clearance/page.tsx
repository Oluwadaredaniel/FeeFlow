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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clearance Status</h1>
        <p className="text-muted-foreground">Check if you have met all institutional requirements</p>
      </div>

      <Card className="text-center py-12 space-y-6">
        <CardContent>
          <div className="flex justify-center mb-6">
            {status === true ? (
              <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <CheckCircle2 className="h-12 w-12" />
              </div>
            ) : (
              <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <XCircle className="h-12 w-12" />
              </div>
            )}
          </div>

          <h2 className="text-2xl font-bold">
            {status ? "You are fully cleared!" : "Not Cleared"}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {status
              ? "All your financial obligations have been settled. You can now proceed with your graduation or deferment processes."
              : "You have outstanding balances or missing requirements. Please check your fee statement to resolve these issues."}
          </p>

          {status && (
            <Button className="mt-6 gap-2" onClick={() => toast.info("Downloading clearance certificate...")}>
              <Download className="h-4 w-4" /> Download Clearance Certificate
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
