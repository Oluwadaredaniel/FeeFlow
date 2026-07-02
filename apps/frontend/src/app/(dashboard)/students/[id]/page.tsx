"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui-ext/status-badge";
import { FeeProgressBar } from "@/components/ui-ext/progress-bar";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/money";
import { toast } from "sonner";
import { ArrowLeft, UserX, GraduationCap, Wallet } from "lucide-react";

interface StudentProfile {
  id: string;
  full_name: string;
  matric_no: string;
  department: string;
  level: number;
  status: "ACTIVE" | "DEFERRED" | "GRADUATED" | "INACTIVE";
  is_cleared: boolean;
  total_owed: number;
  total_paid: number;
}

interface StudentFee {
  id: string;
  name: string;
  amount_due: number;
  amount_paid: number;
  status: "PAID" | "PARTIALLY_PAID" | "UNPAID";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function StudentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStudent() {
      try {
        const [studentData, feesData] = await Promise.all([
          api.get<StudentProfile>(`/students/${id}`),
          api.get<StudentFee[]>(`/students/${id}/fees`),
        ]);
        setStudent(studentData);
        setFees(feesData);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Failed to load student details"));
      } finally {
        setIsLoading(false);
      }
    }
    loadStudent();
  }, [id]);

  async function updateStatus(status: "DEFERRED" | "GRADUATED" | "INACTIVE") {
    try {
      await api.patch(`/students/${id}`, { status });
      toast.success(`Student marked as ${status}`);
      window.location.reload();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to update status"));
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!student) {
    return <div className="text-center py-12">Student not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="surface-glass flex flex-col gap-5 rounded-[2rem] p-6 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-heading text-4xl tracking-[-0.05em]">{student.full_name}</h1>
            <p className="mt-2 text-muted-foreground">{student.matric_no} • {student.department} • Level {student.level}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => updateStatus("DEFERRED")} className="h-10 rounded-xl text-xs">
            <UserX className="mr-2 h-3 w-3" /> Defer
          </Button>
          <Button variant="outline" onClick={() => updateStatus("GRADUATED")} className="h-10 rounded-xl text-xs">
            <GraduationCap className="mr-2 h-3 w-3" /> Graduate
          </Button>
          <Button variant="destructive" onClick={() => updateStatus("INACTIVE")} className="h-10 rounded-xl text-xs">
            <UserX className="mr-2 h-3 w-3" /> Deactivate
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Academic Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Enrollment Status</span>
              <StatusBadge status={student.status} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Clearance Status</span>
              <StatusBadge status={student.is_cleared} />
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Financial Summary</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Due</p>
              <p className="text-lg font-bold">{formatNaira(student.total_owed)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="text-lg font-bold text-emerald-400">{formatNaira(student.total_paid)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="text-lg font-bold text-red-400">{formatNaira(student.total_owed - student.total_paid)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fee Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {fees.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No fees assigned to this student.</p>
            ) : (
              fees.map((fee) => (
                <div key={fee.id} className="flex flex-col justify-between gap-4 rounded-[1.25rem] border border-border/80 bg-background/30 p-4 md:flex-row md:items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{fee.name}</span>
                      <StatusBadge status={fee.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatNaira(fee.amount_paid)} paid of {formatNaira(fee.amount_due)}
                    </p>
                  </div>
                  <div className="w-full md:w-64">
                    <FeeProgressBar paid={fee.amount_paid} due={fee.amount_due} />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
