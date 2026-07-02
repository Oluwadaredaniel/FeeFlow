"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui-ext/status-badge";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/money";
import { toast } from "sonner";
import { User, GraduationCap, CreditCard, Download, CheckCircle } from "lucide-react";

interface StudentProfile {
  id: string;
  full_name: string;
  email: string;
  matric_no: string;
  department: string;
  level: number;
  status: "ACTIVE" | "DEFERRED" | "GRADUATED" | "INACTIVE";
  is_cleared: boolean;
  total_owed: number;
  total_paid: number;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await api.get<StudentProfile>("/me");
        setProfile(data);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Failed to load profile"));
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!profile) {
    return <div className="text-center py-12">Profile not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="surface-glass rounded-[2rem] p-6">
        <div className="mb-3 inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary">
          Student profile
        </div>
        <h1 className="font-heading text-4xl tracking-[-0.05em]">My Profile</h1>
        <p className="mt-2 text-muted-foreground">Your academic and financial identity.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardContent className="flex flex-col items-center space-y-5 pt-6 text-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] border border-primary/20 bg-primary/10 text-primary">
              <User className="h-12 w-12" />
            </div>
            <div>
              <h2 className="font-heading text-3xl tracking-[-0.03em]">{profile.full_name}</h2>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <div className="flex justify-between border-b py-3 text-sm">
                <span className="text-muted-foreground">Matric No:</span>
                <span className="font-medium">{profile.matric_no}</span>
              </div>
              <div className="flex justify-between border-b py-3 text-sm">
                <span className="text-muted-foreground">Department:</span>
                <span className="font-medium">{profile.department}</span>
              </div>
              <div className="flex justify-between border-b py-3 text-sm">
                <span className="text-muted-foreground">Level:</span>
                <span className="font-medium">{profile.level}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Academic Status</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Enrollment</span>
                  <StatusBadge status={profile.status} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clearance Status</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Financials</span>
                  <StatusBadge status={profile.is_cleared} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Account Summary</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Billed</p>
                <p className="text-lg font-bold">{formatNaira(profile.total_owed)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="text-lg font-bold text-emerald-400">{formatNaira(profile.total_paid)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="text-lg font-bold text-red-400">{formatNaira(profile.total_owed - profile.total_paid)}</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button variant="outline" className="h-11 gap-2 rounded-xl px-4" onClick={() => toast.info("Generating PDF profile...")}>
              <Download className="h-4 w-4" /> Download Student ID
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
