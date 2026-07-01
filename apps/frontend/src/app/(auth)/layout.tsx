export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(2,143,156,0.2),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(95,214,163,0.12),transparent_25%)]" />
      <div className="relative grid w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="mb-6 inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary">
              Fee Operations, Reframed
            </div>
            <h1 className="headline-balance font-heading text-6xl leading-[0.95] tracking-[-0.05em] text-foreground">
              Move institutional payments out of spreadsheet mode.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              FeeFlow gives finance teams and students a cleaner, faster interface for collections,
              receipts, clearance, and visibility.
            </p>
          </div>
          <div className="surface-panel rounded-[2rem] p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground">Receipts</p>
                <p className="mt-2 font-heading text-3xl">Instant</p>
              </div>
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground">Clearance</p>
                <p className="mt-2 font-heading text-3xl">Tracked</p>
              </div>
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground">Admin Flow</p>
                <p className="mt-2 font-heading text-3xl">Focused</p>
              </div>
            </div>
          </div>
        </section>
        <div className="surface-glass w-full max-w-md justify-self-center rounded-[2rem] p-6 sm:p-8">
          <div className="mb-8">
            <h1 className="font-heading text-4xl tracking-[-0.04em] text-foreground">FeeFlow</h1>
            <p className="mt-2 text-sm text-muted-foreground">Secure payment management for modern institutions</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
