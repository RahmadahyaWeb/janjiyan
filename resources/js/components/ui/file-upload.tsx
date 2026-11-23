import * as React from "react"
import { Upload, X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface FileUploadProps
  extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> {
  id: string
  file: File | null
  onFileChange: (file: File | null) => void
  placeholder: string
  clearLabel?: string
  wrapperClassName?: string
}

function FileUpload({
  id,
  file,
  onFileChange,
  placeholder,
  clearLabel = "Hapus file dipilih",
  className,
  wrapperClassName,
  disabled,
  ...props
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = ""
    }
    onFileChange(null)
  }

  return (
    <div className={cn("relative w-full min-w-0", wrapperClassName)}>
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-sm border border-dashed border-control-border bg-field px-4 py-3 text-sm text-ink transition-colors hover:bg-bone focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2",
          file && "pr-11",
          disabled && "pointer-events-none cursor-not-allowed opacity-50",
          className
        )}
      >
        <Upload className="size-4 shrink-0 text-mute" aria-hidden="true" />
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          {file ? file.name : placeholder}
        </span>
        <input
          ref={inputRef}
          id={id}
          type="file"
          disabled={disabled}
          className="sr-only"
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          {...props}
        />
      </label>

      {file && !disabled && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={handleClear}
          className="absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-mute transition-colors hover:bg-canvas hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export { FileUpload }
