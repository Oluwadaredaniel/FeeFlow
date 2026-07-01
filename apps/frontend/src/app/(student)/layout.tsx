"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/auth/role-guard";
import { clearSession } from "@/lib/auth";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <RoleGuard role="STUDENT">
      <div className="min-h-screen bg-background px-4 py-4 md:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col gap-4">
          <header className="surface-glass flex shrink-0 items-center justify-between rounded-[1.75rem] px-6 py-4">
          <div className="flex items-center gap-4">
            <div>
              <span className="font-heading text-3xl font-medium tracking-[-0.03em] text-foreground">FeeFlow</span>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Student workspace</p>
            </div>
            <nav className="ml-4 hidden items-center gap-2 text-sm font-medium text-muted-foreground md:flex">
              <Link href="/student/me" className="rounded-full px-4 py-2 hover:bg-muted/40 hover:text-foreground">My Account</Link>
              <Link href="/student/fees" className="rounded-full px-4 py-2 hover:bg-muted/40 hover:text-foreground">My Fees</Link>
              <Link href="/student/clearance" className="rounded-full px-4 py-2 hover:bg-muted/40 hover:text-foreground">Clearance</Link>
              <Link href="/student/receipts" className="rounded-full px-4 py-2 hover:bg-muted/40 hover:text-foreground">Receipts</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                clearSession();
                router.replace("/student-login");
              }}
              className="rounded-full border border-border/80 bg-background/30 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive"
            >
              Logout
            </button>
          </div>
          </header>
          <main className="surface-glass flex-1 rounded-[1.75rem] p-6 md:p-8">
            <div className="mx-auto w-full max-w-4xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
