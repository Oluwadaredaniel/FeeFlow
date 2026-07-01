import * as React from "react"

const Textarea = React.forwardRef<
  React.ElementRef<"textarea">,
  React.ComponentPropsWithoutRef<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={`flex min-h-[112px] w-full rounded-xl border border-input bg-input/40 px-3.5 py-3 text-sm text-foreground shadow-[0_1px_0_rgb(255_255_255_/_0.02)_inset] placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:bg-input/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
