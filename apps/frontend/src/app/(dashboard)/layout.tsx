"use client";

import { AdminSidebar } from "@/components/layout/admin-sidebar";
import RoleGuard from "@/components/auth/role-guard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="ADMIN">
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-7xl pb-8">
            {children}
          </div>
        </main>
      </div>
    </RoleGuard>
  );
}
