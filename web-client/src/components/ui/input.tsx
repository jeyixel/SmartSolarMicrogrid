import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const inputVariants = cva(
  [
    "flex w-full rounded border border-slate-300 bg-white px-3 py-2 font-sans text-[13px] text-slate-800 transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-slate-800 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:shadow-[0_0_0_1px_rgba(79,70,229,0.15)] disabled:cursor-not-allowed disabled:opacity-50",
    // A field the server rejected is marked through aria-invalid, so the
    // styling and the accessibility state cannot drift apart.
    "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:border-destructive aria-[invalid=true]:focus:shadow-[0_0_0_1px_rgba(220,38,38,0.2)]",
  ],
  {
    variants: {
      inputSize: {
        default: "h-9",
        sm: "h-8",
      },
    },
    defaultVariants: {
      inputSize: "default",
    },
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, inputSize, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ inputSize, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
