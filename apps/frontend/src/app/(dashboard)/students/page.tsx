"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui-ext/data-table";
import { StatusBadge } from "@/components/ui-ext/status-badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import { Plus, ExternalLink, Users } from "lucide-react";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  matric_number: string;
  email: string;
  department: string;
  level: number;
  status: "ACTIVE" | "DEFERRED" | "GRADUATED" | "INACTIVE";
  clearance_status?: Array<{ is_cleared: boolean }>;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStudents = async () => {
    try {
      const data = await api.get<Student[]>("/api/students");
      setStudents(data);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to load students"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchStudents();
    });
  }, []);

  const handleSearch = async (query: string) => {
    try {
      const data = await api.get<Student[]>(`/api/students?search=${encodeURIComponent(query)}`);
      setStudents(data);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Search failed"));
    }
  };

  const columns = [
    { header: "Student", accessor: (s: Student) => (
      <div className="flex flex-col">
        <span className="font-medium">{s.first_name} {s.last_name}</span>
        <span className="text-xs text-muted-foreground">{s.matric_number}</span>
      </div>
    )},
    { header: "Department", accessor: "department" },
    { header: "Level", accessor: (s: Student) => s.level },
    { header: "Status", accessor: (s: Student) => <StatusBadge status={s.status} /> },
    { header: "Cleared", accessor: (s: Student) => {
      const isCleared = s.clearance_status?.[0]?.is_cleared || false;
      return <StatusBadge status={isCleared ? "CLEARED" : "NOT CLEARED"} />;
    }},
    {
      header: "Action",
      accessor: (s: Student) => (
        <Link
          href={`/students/${s.id}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View <ExternalLink className="h-3 w-3" />
        </Link>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <div className="surface-glass flex flex-col gap-5 rounded-[2rem] p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary">
            Directory
          </div>
          <h1 className="font-heading text-4xl tracking-[-0.05em]">Students</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Manage all enrolled students and their academic status.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="h-11 rounded-xl" asChild>
            <Link href="/students/import">Import CSV</Link>
          </Button>
          <Button className="h-11 rounded-xl" asChild>
            <Link href="/students/new">
              <Plus className="mr-2 h-4 w-4" /> Add Student
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <DataTable
          data={students}
          columns={columns}
          onSearch={handleSearch}
          emptyState={
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-20" />
              <p>No students found matching your criteria.</p>
            </div>
          }
        />
      )}
    </div>
  );
}
