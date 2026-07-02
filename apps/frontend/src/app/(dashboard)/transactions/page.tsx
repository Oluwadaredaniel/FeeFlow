"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui-ext/data-table";
import { StatusBadge } from "@/components/ui-ext/status-badge";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/money";
import { toast } from "sonner";
import { Download, Filter } from "lucide-react";

interface Transaction {
  id: string;
  student_id: string;
  student_name: string;
  amount: number;
  status: "SUCCESS" | "FAILED" | "PENDING";
  payment_method: string;
  created_at: string;
  reference: string;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTransactions = async () => {
    try {
      const data = await api.get<Transaction[]>("/payments");
      setTransactions(data);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to load transactions"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchTransactions();
    });
  }, []);

  const columns = [
    { header: "Reference", accessor: (t: Transaction) => (
      <span className="font-mono text-xs">{t.reference}</span>
    )},
    { header: "Student", accessor: (t: Transaction) => (
      <div className="flex flex-col">
        <span className="font-medium">{t.student_name}</span>
        <span className="text-xs text-muted-foreground">{t.student_id}</span>
      </div>
    )},
    { header: "Amount", accessor: (t: Transaction) => formatNaira(t.amount) },
    { header: "Method", accessor: "payment_method" },
    { header: "Status", accessor: (t: Transaction) => <StatusBadge status={t.status} /> },
    {
      header: "Date",
      accessor: (t: Transaction) => new Date(t.created_at).toLocaleDateString("en-NG", {
        dateStyle: "medium"
      })
    },
  ];

  return (
    <div className="space-y-6">
      <div className="surface-glass flex flex-col gap-5 rounded-[2rem] p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary">
            Ledger
          </div>
          <h1 className="font-heading text-4xl tracking-[-0.05em]">Transactions</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">All institutional payment logs and reconciliation status.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="h-11 gap-2 rounded-xl px-4">
            <Filter className="h-4 w-4" /> Filter
          </Button>
          <Button variant="outline" size="sm" className="h-11 gap-2 rounded-xl px-4" onClick={() => toast.info("Exporting CSV...")}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <DataTable
          data={transactions}
          columns={columns}
          emptyState={
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <p>No transactions found.</p>
            </div>
          }
        />
      )}
    </div>
  );
}
