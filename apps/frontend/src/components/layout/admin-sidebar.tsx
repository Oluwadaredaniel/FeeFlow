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
    <aside className="flex h-screen w-64 flex-col border-r bg-slate-50/50">
      <div className="flex h-16 items-center px-6 border-b bg-white">
        <span className="text-xl font-bold text-primary">FeeFlow <span className="text-xs font-medium text-muted-foreground">ADMIN</span></span>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-slate-200 hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
