"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui-ext/data-table";
import { StatusBadge } from "@/components/ui-ext/status-badge";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/money";
import { toast } from "sonner";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";

interface FeeTemplate {
  id: string;
  name: string;
  amount: number;
  description: string;
  assigned_to_level: number;
  is_active: boolean;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function FeesPage() {
  const [templates, setTemplates] = useState<FeeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTemplates = async () => {
    try {
      const data = await api.get<FeeTemplate[]>("/fees/templates");
      setTemplates(data);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to load fee templates"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchTemplates();
    });
  }, []);

  async function deleteTemplate(id: string) {
    if (!confirm("Are you sure you want to delete this fee template? This cannot be undone.")) return;
    try {
      await api.post(`/fees/templates/${id}/delete`);
      toast.success("Fee template deleted");
      fetchTemplates();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to delete template"));
    }
  }

  const columns = [
    { header: "Fee Name", accessor: (f: FeeTemplate) => (
      <div className="flex flex-col">
        <span className="font-medium">{f.name}</span>
        <span className="text-xs text-muted-foreground">{f.description}</span>
      </div>
    )},
    { header: "Amount", accessor: (f: FeeTemplate) => formatNaira(f.amount) },
    { header: "Target Level", accessor: (f: FeeTemplate) => `Level ${f.assigned_to_level}` },
    { header: "Status", accessor: (f: FeeTemplate) => <StatusBadge status={f.is_active} /> },
    {
      header: "Action",
      accessor: (f: FeeTemplate) => (
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => deleteTemplate(f.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fee Templates</h1>
          <p className="text-muted-foreground">Define standard fee structures for students based on their level</p>
        </div>
        <Button asChild>
          <Link href="/fees/new">
            <Plus className="mr-2 h-4 w-4" /> Create Fee
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <DataTable
          data={templates}
          columns={columns}
          emptyState={
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <p>No fee templates defined yet.</p>
            </div>
          }
        />
      )}
    </div>
  );
}
