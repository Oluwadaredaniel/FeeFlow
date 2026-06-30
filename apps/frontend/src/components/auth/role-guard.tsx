"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";

interface RoleGuardProps {
  role: "ADMIN" | "STUDENT";
  children: React.ReactNode;
}

export default function RoleGuard({ role, children }: RoleGuardProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const session = getSession();

    if (!session) {
      router.replace(role === "ADMIN" ? "/login" : "/student-login");
      return;
    }

    if (session.user.role !== role) {
      router.replace(session.user.role === "ADMIN" ? "/dashboard" : "/student/me");
      return;
    }

    queueMicrotask(() => {
      setIsAuthorized(true);
    });
  }, [role, router]);

  if (!isAuthorized) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return <>{children}</>;
}
