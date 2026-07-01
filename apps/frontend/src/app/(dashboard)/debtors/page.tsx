"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/ui-ext/data-table";
import { StatusBadge } from "@/components/ui-ext/status-badge";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/money";
import { toast } from "sonner";
import { User } from "lucide-react";

interface Debtor {
  id: string;
  full_name: string;
  matric_no: string;
  total_owed: number;
  total_paid: number;
  balance: number;
  is_cleared: boolean;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function DebtorsPage() {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDebtors = async () => {
    try {
      const data = await api.get<Debtor[]>("/debtors");
      setDebtors(data);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to load debtors list"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchDebtors();
    });
  }, []);

  const columns = [
    { header: "Student", accessor: (d: Debtor) => (
      <div className="flex flex-col">
        <span className="font-medium">{d.full_name}</span>
        <span className="text-xs text-muted-foreground">{d.matric_no}</span>
      </div>
    )},
    { header: "Total Due", accessor: (d: Debtor) => formatNaira(d.total_owed) },
    { header: "Paid", accessor: (d: Debtor) => formatNaira(d.total_paid) },
    {
      header: "Balance",
      accessor: (d: Debtor) => (
        <span className="font-bold text-red-400">{formatNaira(d.balance)}</span>
      )
    },
    { header: "Status", accessor: (d: Debtor) => <StatusBadge status={d.is_cleared} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="surface-glass rounded-[2rem] p-6">
        <div className="mb-3 inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary">
          Collections risk
        </div>
        <h1 className="font-heading text-4xl tracking-[-0.05em]">Debtors List</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Students with outstanding balances for the current session.</p>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <DataTable
          data={debtors}
          columns={columns}
          emptyState={
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mb-4 opacity-20" />
              <p>All accounts are settled. No debtors found.</p>
            </div>
          }
        />
      )}
    </div>
  );
}
