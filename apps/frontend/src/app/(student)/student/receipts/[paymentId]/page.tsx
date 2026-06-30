"use client";

import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/money";
import { toast } from "sonner";
import { Receipt, Download, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

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

export default function ReceiptDetailPage() {
  const { paymentId } = useParams();
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReceipt() {
      try {
        // In MVP, we assume the student's payment list is filtered client-side
        // but provide a specific endpoint for the receipt detail
        const data = await api.get<PaymentReceipt>(`/me/payments/${paymentId}`);
        setReceipt(data);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Failed to load receipt details"));
      } finally {
        setIsLoading(false);
      }
    }
    loadReceipt();
  }, [paymentId]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!receipt) {
    return <div className="text-center py-12">Receipt not found.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Payment Receipt</h1>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Generating official PDF receipt...")}>
          <Download className="h-4 w-4" /> Download PDF
        </Button>
      </div>

      <Card className="border-2 border-slate-200 shadow-lg overflow-hidden">
        <div className="bg-slate-50 border-b p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary text-white flex items-center justify-center">
              <Receipt className="h-8 w-8" />
            </div>
          </div>
          <h2 className="text-2xl font-bold uppercase tracking-wide">Official Receipt</h2>
          <p className="text-muted-foreground text-sm">FeeFlow Institutional Payment System</p>
        </div>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Transaction Reference</p>
                <p className="font-mono text-sm">{receipt.reference}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Payment Date</p>
                <p className="text-sm">{new Date(receipt.created_at).toLocaleDateString("en-NG", {
                  dateStyle: "full"
                })}</p>
              </div>
            </div>
            <div className="text-right space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Payment Method</p>
                <p className="text-sm font-medium">{receipt.payment_method}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Status</p>
                <div className="flex justify-end">
                  <span className="text-sm font-bold text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> SUCCESS
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-b py-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Description: <span className="font-medium text-foreground">{receipt.fee_name}</span></span>
              <span className="font-bold text-lg">{formatNaira(receipt.amount)}</span>
            </div>
          </div>

          <div className="flex justify-between items-end pt-4">
            <div className="text-xs text-muted-foreground italic">
              Generated electronically by FeeFlow. No physical signature required.
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Total Amount</p>
              <p className="text-3xl font-black text-primary">{formatNaira(receipt.amount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
