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

interface DashboardStats {
  total_students: number;
  total_revenue: number;
  total_debt: number;
  clearance_rate: number;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Using a generic stats endpoint as inferred from spec
        const data = await api.get<DashboardStats>("/dashboard/stats");
        setStats(data);
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

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No statistics available at this time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financial Overview</h1>
        <p className="text-muted-foreground">Real-time institution financial health monitoring</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Students"
          value={stats.total_students.toLocaleString()}
          description="Enrolled active students"
          icon={Users}
        />
        <StatCard
          title="Total Revenue"
          value={formatNaira(stats.total_revenue)}
          description="Total payments reconciled"
          icon={Banknote}
          trend={{ value: "12%", isPositive: true }}
        />
        <StatCard
          title="Total Debt"
          value={formatNaira(stats.total_debt)}
          description="Outstanding student balances"
          icon={AlertCircle}
          trend={{ value: "4%", isPositive: false }}
        />
        <StatCard
          title="Clearance Rate"
          value={`${stats.clearance_rate}%`}
          description="Students cleared for session"
          icon={CheckCircle2}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Revenue Trend</h3>
          </div>
          <div className="h-64 flex items-end justify-between gap-2">
            {/* Mock Chart Bars */}
            {[40, 70, 45, 90, 65, 80, 95].map((h, i) => (
              <div
                key={i}
                className="w-full bg-primary/20 rounded-t-sm transition-all hover:bg-primary"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/students/import" className="p-3 rounded-lg border hover:bg-slate-50 text-sm font-medium text-center transition-colors">
              Import Students
            </Link>
            <Link href="/fees/new" className="p-3 rounded-lg border hover:bg-slate-50 text-sm font-medium text-center transition-colors">
              Create Fee Template
            </Link>
            <Link href="/debtors" className="p-3 rounded-lg border hover:bg-slate-50 text-sm font-medium text-center transition-colors">
              View Debtors
            </Link>
            <Link href="/clearance" className="p-3 rounded-lg border hover:bg-slate-50 text-sm font-medium text-center transition-colors">
              Manage Clearance
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
