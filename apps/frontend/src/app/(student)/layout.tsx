"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/auth/role-guard";
import { clearSession } from "@/lib/auth";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <RoleGuard role="STUDENT">
      <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
        <header className="h-16 border-b bg-white px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold text-primary">FeeFlow</span>
            <nav className="hidden md:flex items-center gap-6 ml-4 text-sm font-medium text-muted-foreground">
              <Link href="/student/me" className="hover:text-foreground">My Account</Link>
              <Link href="/student/fees" className="hover:text-foreground">My Fees</Link>
              <Link href="/student/clearance" className="hover:text-foreground">Clearance</Link>
              <Link href="/student/receipts" className="hover:text-foreground">Receipts</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                clearSession();
                router.replace("/student-login");
              }}
              className="text-sm font-medium text-muted-foreground hover:text-destructive"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-4xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </RoleGuard>
  );
}
