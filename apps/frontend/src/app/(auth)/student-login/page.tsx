"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function StudentLoginPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await api.post("/auth/login", { email, role: "STUDENT" });
      toast.success("Verification code sent to your email");
      router.push(`/verify?email=${encodeURIComponent(email)}&role=STUDENT`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to send verification code"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary">
          Student Access
        </div>
        <h2 className="font-heading text-4xl tracking-[-0.04em]">Student Sign In</h2>
        <p className="text-sm leading-6 text-muted-foreground">Enter your student email to receive a verification code.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Student Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="student@institution.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="h-11 w-full rounded-xl" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send Code
        </Button>
      </form>
      <div className="border-t border-border/70 pt-4 text-center">
        <Link href="/login" className="text-sm text-primary hover:underline">
          I am an administrator
        </Link>
      </div>
    </div>
  );
}
