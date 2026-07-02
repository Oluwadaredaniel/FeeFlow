"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatCard } from "@/components/ui-ext/stat-card";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/money";
import {
  Users,
  Banknote,
  AlertCircle,
  CheckCircle2,
  TrendingUp
} from "lucide-react";
import { toast } from "sonner";

interface CollectionReport {
  summary: {
    total_revenue: number;
    total_students: number;
    students_cleared: number;
    students_owing: number;
    collection_rate: number;
  };
  by_fee_type: Array<{
    fee_type: string;
    amount_expected: number;
    amount_collected: number;
    collection_rate: number;
  }>;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminDashboard() {
  const [report, setReport] = useState<CollectionReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await api.get<CollectionReport>("/api/reports/collection");
        setReport(data);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Failed to load dashboard statistics"));
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No statistics available at this time.</p>
      </div>
    );
  }

  const { summary, by_fee_type } = report;
  const total_debt = by_fee_type.reduce((acc, f) => acc + (f.amount_expected - f.amount_collected), 0);

  return (
    <div className="space-y-8">
      <section className="surface-glass overflow-hidden rounded-[2rem] p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-4 inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary">
              Finance overview
            </div>
            <h1 className="headline-balance font-heading text-5xl leading-[0.95] tracking-[-0.05em]">
              Revenue clarity for the entire institution.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              Track collections, debt, and clearance progress in one place with a calmer operational view.
            </p>
          </div>
          <div className="surface-panel rounded-[1.75rem] p-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Monthly pulse</h3>
            </div>
            <div className="mt-6 flex h-44 items-end justify-between gap-2">
              {[40, 70, 45, 90, 65, 80, 95].map((h, i) => (
                <div
                  key={i}
                  className="w-full rounded-full bg-primary/15 p-1"
                >
                  <div
                    className="w-full rounded-full bg-[linear-gradient(180deg,rgba(95,214,163,0.95),rgba(2,143,156,0.95))] transition-all"
                    style={{ height: `${h}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
              <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span>
            </div>
          </div>
        </div>
      </section>

      <div>
        <h2 className="font-heading text-3xl tracking-[-0.04em]">Financial Overview</h2>
        <p className="mt-2 text-muted-foreground">Real-time institution financial health monitoring</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Students"
          value={summary.total_students.toLocaleString()}
          description="Enrolled active students"
          icon={Users}
        />
        <StatCard
          title="Total Revenue"
          value={formatNaira(summary.total_revenue)}
          description="Total payments reconciled"
          icon={Banknote}
          trend={{ value: "12%", isPositive: true }}
        />
        <StatCard
          title="Total Debt"
          value={formatNaira(total_debt)}
          description="Outstanding student balances"
          icon={AlertCircle}
          trend={{ value: "4%", isPositive: false }}
        />
        <StatCard
          title="Clearance Rate"
          value={`${Math.round(summary.collection_rate)}%`}
          description="Students cleared for session"
          icon={CheckCircle2}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="surface-panel rounded-[1.75rem] p-6">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Revenue Trend</h3>
          </div>
          <div className="flex h-64 items-end justify-between gap-3">
            {[40, 70, 45, 90, 65, 80, 95].map((h, i) => (
              <div key={i} className="flex w-full items-end rounded-full bg-primary/10 p-1">
                <div
                  className="w-full rounded-full bg-[linear-gradient(180deg,rgba(95,214,163,0.95),rgba(2,143,156,0.95))] transition-all"
                  style={{ height: `${h}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
            <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span>
          </div>
        </div>

        <div className="surface-panel rounded-[1.75rem] p-6">
          <div className="mb-4">
            <h3 className="font-heading text-2xl tracking-[-0.03em]">Quick Actions</h3>
            <p className="mt-1 text-sm text-muted-foreground">Jump into the high-frequency admin workflows.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/students/import" className="rounded-2xl border border-border/80 bg-background/25 p-4 text-left text-sm font-medium transition-colors hover:bg-muted/40">
              Import Students
            </Link>
            <Link href="/fees/new" className="rounded-2xl border border-border/80 bg-background/25 p-4 text-left text-sm font-medium transition-colors hover:bg-muted/40">
              Create Fee Template
            </Link>
            <Link href="/debtors" className="rounded-2xl border border-border/80 bg-background/25 p-4 text-left text-sm font-medium transition-colors hover:bg-muted/40">
              View Debtors
            </Link>
            <Link href="/clearance" className="rounded-2xl border border-border/80 bg-background/25 p-4 text-left text-sm font-medium transition-colors hover:bg-muted/40">
              Manage Clearance
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
