"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function NewFeePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    description: "",
    assigned_to_level: "100",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Convert Naira (string) to Kobo (int)
      const amountKobo = Math.round(parseFloat(formData.amount) * 100);

      await api.post("/fees/templates", {
        ...formData,
        amount: amountKobo,
        assigned_to_level: parseInt(formData.assigned_to_level),
      });

      toast.success("Fee template created successfully");
      router.push("/fees");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to create fee template"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="surface-glass rounded-[2rem] p-6">
        <div className="mb-3 inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary">
          New structure
        </div>
        <h1 className="font-heading text-4xl tracking-[-0.05em]">Create Fee Template</h1>
        <p className="mt-2 text-muted-foreground">Define a new payment requirement for a specific student level.</p>
      </div>

      <form onSubmit={handleSubmit} className="surface-panel space-y-6 rounded-[1.75rem] p-6">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Fee Name</Label>
            <Input
              id="name"
              placeholder="e.g. Tuition Fee - 100 Level"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₦)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">Target Level</Label>
              <select
                id="level"
                className="flex h-11 w-full rounded-xl border border-input bg-input/40 px-3.5 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-4 focus:ring-ring/20"
                value={formData.assigned_to_level}
                onChange={(e) => setFormData({ ...formData, assigned_to_level: e.target.value })}
              >
                <option value="100">100 Level</option>
                <option value="200">200 Level</option>
                <option value="300">300 Level</option>
                <option value="400">400 Level</option>
                <option value="500">500 Level</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Provide details about what this fee covers..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" type="button" className="h-11 rounded-xl px-4" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" className="h-11 rounded-xl px-4" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Template
          </Button>
        </div>
      </form>
    </div>
  );
}
