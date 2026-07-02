"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface OtpFormProps {
  title: string;
  description: string;
  onVerify: (otp: string) => Promise<void>;
  isLoading: boolean;
}

export function OtpForm({ title, description, onVerify, isLoading }: OtpFormProps) {
  const [otp, setOtp] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onVerify(otp);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary">
          Verification
        </div>
        <h2 className="font-heading text-4xl tracking-[-0.04em]">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="code">Verification Code</Label>
          <Input
            id="code"
            placeholder="Enter 6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
            className="text-center text-xl tracking-[0.6em]"
            required
          />
        </div>
        <Button type="submit" className="h-11 w-full rounded-xl" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify & Sign In
        </Button>
      </form>
    </div>
  );
}
