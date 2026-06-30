import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-2xl rounded-xl border bg-white p-10 shadow-sm">
        <div className="space-y-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">FeeFlow</h1>
            <p className="mt-3 text-base text-muted-foreground">
              Institutional fee management for administrators and students.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Administrator Sign In
            </Link>
            <Link
              href="/student-login"
              className="inline-flex h-11 items-center justify-center rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:bg-slate-50"
            >
              Student Sign In
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
