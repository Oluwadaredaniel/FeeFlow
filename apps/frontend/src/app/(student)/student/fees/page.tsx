"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeeProgressBar } from "@/components/ui-ext/progress-bar";
import { StatusBadge } from "@/components/ui-ext/status-badge";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/money";
import { toast } from "sonner";
import { Receipt, Wallet, AlertCircle } from "lucide-react";

interface StudentFee {
  id: string;
  name: string;
  amount_due: number;
  amount_paid: number;
  status: "PAID" | "PARTIALLY_PAID" | "UNPAID";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function StudentFeesPage() {
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadFees() {
      try {
        const data = await api.get<StudentFee[]>("/me/fees");
        setFees(data);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Failed to load your fees"));
      } finally {
        setIsLoading(false);
      }
    }
    loadFees();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const totalDue = fees.reduce((sum, f) => sum + f.amount_due, 0);
  const totalPaid = fees.reduce((sum, f) => sum + f.amount_paid, 0);

  return (
    <div className="space-y-6">
      <div className="surface-glass rounded-[2rem] p-6">
        <div className="mb-3 inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary">
          Payment position
        </div>
        <h1 className="font-heading text-4xl tracking-[-0.05em]">My Fee Statement</h1>
        <p className="mt-2 text-muted-foreground">Track your payment progress and outstanding balances.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNaira(totalDue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{formatNaira(totalPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Due</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{formatNaira(totalDue - totalPaid)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="font-heading text-2xl tracking-[-0.03em]">Detailed Breakdown</h3>
        {fees.length === 0 ? (
          <div className="rounded-[1.5rem] border bg-card py-12 text-center">
            <p className="text-muted-foreground">No fees assigned to your account.</p>
          </div>
        ) : (
          fees.map((fee) => (
            <Card key={fee.id}>
              <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{fee.name}</span>
                    <StatusBadge status={fee.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatNaira(fee.amount_paid)} paid of {formatNaira(fee.amount_due)}
                  </p>
                </div>
                <div className="w-full md:w-72">
                  <FeeProgressBar paid={fee.amount_paid} due={fee.amount_due} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
