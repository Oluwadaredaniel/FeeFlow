"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Upload, FileText, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function ImportStudentsPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a CSV file first");
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      await api.upload("/students/import", formData);
      toast.success("Students imported successfully!");
      router.push("/students");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to import students. Please check CSV format."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="surface-glass rounded-[2rem] p-6">
        <div className="mb-3 inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary">
          Bulk onboarding
        </div>
        <h1 className="font-heading text-4xl tracking-[-0.05em]">Import Students</h1>
        <p className="mt-2 text-muted-foreground">Batch upload students using a CSV file.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload CSV</CardTitle>
          <CardDescription>
            Upload a .csv file containing student details. Ensure the columns match the required template.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleUpload} className="space-y-6">
            <div className="flex items-center justify-center w-full">
              <label className="flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-border bg-muted/35 transition-colors hover:bg-muted/50">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground/80">CSV (MAX. 10MB)</p>
                </div>
                <input type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
              </label>
            </div>

            {file && (
              <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
                <FileText className="h-5 w-5 text-primary" />
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Remove</Button>
              </div>
            )}

            <Button type="submit" className="h-11 w-full rounded-xl" disabled={isLoading || !file}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Import
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex gap-3 rounded-[1.5rem] border border-primary/25 bg-primary/10 p-5">
        <AlertCircle className="h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-1 text-sm text-foreground/85">
          <p className="font-semibold">CSV Template Requirements:</p>
          <ul className="list-disc list-inside opacity-90">
            <li>Columns: <code className="rounded bg-background/80 px-1">full_name, email, matric_no, department, level</code></li>
            <li>Email must be a valid university email address.</li>
            <li>Level must be a numeric value (e.g., 100, 200).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
