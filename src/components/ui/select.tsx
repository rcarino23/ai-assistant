import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative inline-flex items-center">
      <select
        ref={ref}
        className={cn(
          "appearance-none rounded-lg border border-border bg-surface py-1.5 pl-3 pr-8 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-40",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted" />
    </div>
  )
);
Select.displayName = "Select";
