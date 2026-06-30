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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Students</h1>
        <p className="text-muted-foreground">Batch upload students using a CSV file</p>
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
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 border-slate-300 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 mb-3 text-slate-400" />
                  <p className="mb-2 text-sm text-slate-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-slate-400">CSV (MAX. 10MB)</p>
                </div>
                <input type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
              </label>
            </div>

            {file && (
              <div className="flex items-center gap-3 p-3 rounded-md bg-primary/5 border border-primary/20">
                <FileText className="h-5 w-5 text-primary" />
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Remove</Button>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading || !file}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Import
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
        <div className="text-sm text-amber-800 space-y-1">
          <p className="font-semibold">CSV Template Requirements:</p>
          <ul className="list-disc list-inside opacity-90">
            <li>Columns: <code className="bg-amber-100 px-1 rounded">full_name, email, matric_no, department, level</code></li>
            <li>Email must be a valid university email address.</li>
            <li>Level must be a numeric value (e.g., 100, 200).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
