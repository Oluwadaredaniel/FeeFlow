import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Receipt,
  Scale,
  FileText,
  Settings,
  TrendingUp,
  UserCheck
} from "lucide-react";

const MENU_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Students", href: "/students", icon: Users },
  { label: "Fees", href: "/fees", icon: Receipt },
  { label: "Transactions", href: "/transactions", icon: TrendingUp },
  { label: "Debtors", href: "/debtors", icon: UserCheck },
  { label: "Clearance", href: "/clearance", icon: Scale },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="surface-glass m-4 mr-0 flex h-[calc(100vh-2rem)] w-72 flex-col overflow-hidden rounded-[1.75rem]">
      <div className="border-b border-border/80 px-6 py-6">
        <div className="mb-4 inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-primary">
          Control Center
        </div>
        <span className="font-heading text-3xl font-medium tracking-[-0.03em] text-foreground">
          FeeFlow
        </span>
        <p className="mt-2 text-sm text-muted-foreground">
          Revenue operations for modern institutions.
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1.5">
        {MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-[0_16px_40px_rgb(2_143_156_/_0.28)]"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              <span className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
                isActive
                  ? "border-primary-foreground/20 bg-primary-foreground/10"
                  : "border-border/80 bg-background/30"
              )}>
                <item.icon className="h-4 w-4" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border/80 p-4">
        <div className="rounded-[1.25rem] border border-border/80 bg-background/40 p-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Admin
          </p>
          <p className="mt-2 font-heading text-xl tracking-[-0.02em]">
            Built for payment clarity
          </p>
        </div>
      </div>
    </aside>
  );
}
