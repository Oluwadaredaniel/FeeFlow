"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/ui-ext/data-table";
import { StatusBadge } from "@/components/ui-ext/status-badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClearanceRecord {
  id: string;
  student_id: string;
  student_name: string;
  matric_no: string;
  is_cleared: boolean;
  cleared_at: string | null;
  cleared_by: string | null;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function ClearancePage() {
  const [records, setRecords] = useState<ClearanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecords = async () => {
    try {
      const data = await api.get<ClearanceRecord[]>("/clearance/records");
      setRecords(data);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to load clearance records"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchRecords();
    });
  }, []);

  async function toggleClearance(id: string, currentStatus: boolean) {
    try {
      await api.patch(`/clearance/${id}`, { is_cleared: !currentStatus });
      toast.success(`Student ${!currentStatus ? "cleared" : "un-cleared"}`);
      fetchRecords();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to update clearance status"));
    }
  }

  const columns = [
    { header: "Student", accessor: (r: ClearanceRecord) => (
      <div className="flex flex-col">
        <span className="font-medium">{r.student_name}</span>
        <span className="text-xs text-muted-foreground">{r.matric_no}</span>
      </div>
    )},
    { header: "Status", accessor: (r: ClearanceRecord) => (
      <div className="flex items-center gap-2">
        <StatusBadge status={r.is_cleared} />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => toggleClearance(r.id, r.is_cleared)}
        >
          {r.is_cleared ? "Revoke" : "Clear"}
        </Button>
      </div>
    )},
    {
      header: "Verification",
      accessor: (r: ClearanceRecord) => (
        <div className="flex flex-col text-xs text-muted-foreground">
          <span>{r.cleared_at ? `Cleared on ${new Date(r.cleared_at).toLocaleDateString()}` : "Pending"}</span>
          <span>{r.cleared_by ? `By ${r.cleared_by}` : ""}</span>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <div className="surface-glass rounded-[2rem] p-6">
        <div className="mb-3 inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary">
          Final sign-off
        </div>
        <h1 className="font-heading text-4xl tracking-[-0.05em]">Clearance Management</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Final sign-off for graduating or deferring students.</p>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <DataTable
          data={records}
          columns={columns}
          emptyState={
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <FileCheck className="h-12 w-12 mb-4 opacity-20" />
              <p>No clearance records found.</p>
            </div>
          }
        />
      )}
    </div>
  );
}
