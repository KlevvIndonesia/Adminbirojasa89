import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, onWheel, ...props }: React.ComponentProps<"input">) {
  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    if (type === "number") {
      e.currentTarget.blur();
    }
    onWheel?.(e);
  };

  return (
    <input
      type={type}
      data-slot="input"
      onWheel={handleWheel}
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/60 selection:bg-primary selection:text-primary-foreground border-border/80 flex h-9 w-full min-w-0 rounded-lg border px-3 py-1.5 text-sm bg-input-background transition-[color,box-shadow,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[2px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        type === "number" && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
