"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/money";
import { toast } from "sonner";
import { Receipt, Download } from "lucide-react";

interface PaymentReceipt {
  id: string;
  amount: number;
  payment_method: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
  created_at: string;
  reference: string;
  fee_name: string;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function StudentReceiptsPage() {
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReceipts() {
      try {
        const data = await api.get<PaymentReceipt[]>("/me/payments");
        setReceipts(data);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Failed to load payment receipts"));
      } finally {
        setIsLoading(false);
      }
    }
    loadReceipts();
  }, []);

  return (
    <div className="space-y-6">
      <div className="surface-glass rounded-[2rem] p-6">
        <div className="mb-3 inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary">
          Payment proof
        </div>
        <h1 className="font-heading text-4xl tracking-[-0.05em]">Payment Receipts</h1>
        <p className="mt-2 text-muted-foreground">Your complete history of successful payments.</p>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid gap-4">
          {receipts.length === 0 ? (
            <div className="rounded-[1.5rem] border bg-card py-12 text-center">
              <p className="text-muted-foreground">No payments found in your history.</p>
            </div>
          ) : (
            receipts.map((receipt) => (
              <Card key={receipt.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row items-center justify-between p-6 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                        <Receipt className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{receipt.fee_name}</span>
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                            SUCCESS
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(receipt.created_at).toLocaleDateString("en-NG", { dateStyle: "medium" })} • Ref: {receipt.reference}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Amount Paid</p>
                        <p className="text-lg font-bold">{formatNaira(receipt.amount)}</p>
                      </div>
                      <Button variant="outline" size="sm" className="h-10 gap-2 rounded-xl px-4" onClick={() => toast.info(`Generating receipt PDF for ${receipt.reference}...`)}>
                        <Download className="h-4 w-4" /> PDF
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
