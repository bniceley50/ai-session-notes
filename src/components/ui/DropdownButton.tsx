"use client";

import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type DropdownButtonProps = {
  label?: string;
  options: string[];
  value?: string;
  onChange?: (v: string) => void;
  /** Override trigger button classes */
  buttonClassName?: string;
  /** Override menu item classes */
  itemClassName?: string;
  /** Override menu container classes */
  menuClassName?: string;
};

/**
 * Shared dropdown button — wraps shadcn DropdownMenu primitives.
 * Used by TranscriptViewer, AIAnalysisViewer, and NoteEditor.
 */
export function DropdownButton({
  label,
  options,
  value,
  onChange,
  buttonClassName,
  itemClassName,
  menuClassName,
}: DropdownButtonProps) {
  const display = useMemo(() => {
    if (label) return value ? `${label}: ${value}` : label;
    return value ?? options[0] ?? "Select";
  }, [label, value, options]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-1",
            buttonClassName,
          )}
        >
          {display}
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={menuClassName}>
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt}
            onClick={() => onChange?.(opt)}
            className={itemClassName}
          >
            {opt}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

