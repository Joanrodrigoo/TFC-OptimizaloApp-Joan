// 📁 src/components/ui/visually-hidden.tsx
import * as React from "react";
import { cn } from "@/lib/utils";


const VisuallyHidden = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0",
          className
        )}
        style={{
          clip: "rect(0, 0, 0, 0)",
          clipPath: "inset(50%)",
        }}
        {...props}
      />
    );
  }
);

VisuallyHidden.displayName = "VisuallyHidden";

export { VisuallyHidden };