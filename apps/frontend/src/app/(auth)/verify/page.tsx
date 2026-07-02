"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { setSession, type Session } from "@/lib/auth";
import { OtpForm } from "@/components/auth/otp-form";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const email = searchParams.get("email");
  const role = searchParams.get("role") as "ADMIN" | "STUDENT";

  if (!email || !role) {
    router.replace("/login");
    return null;
  }

  const handleVerify = async (otp: string) => {
    setIsLoading(true);
    try {
      const session = await api.post<Session>("/auth/verify-otp", { email, otp });
      setSession(session);
      toast.success("Verified successfully!");

      if (role === "ADMIN") {
        router.push("/dashboard");
      } else {
        router.push("/student/me");
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Invalid verification code"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <OtpForm
      title="Verify Your Email"
      description={`Please enter the code sent to ${email}`}
      onVerify={handleVerify}
      isLoading={isLoading}
    />
  );
}
