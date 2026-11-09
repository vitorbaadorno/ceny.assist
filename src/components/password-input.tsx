import { forwardRef, useId, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<ComponentProps<"input">, "type"> & { visibilityLabel?: string };
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ id, className, disabled, visibilityLabel = "senha", ...props }, ref) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input
          {...props}
          id={inputId}
          ref={ref}
          disabled={disabled}
          type={visible ? "text" : "password"}
          className={cn("pr-11", className)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="absolute right-0 top-0 h-9 w-10"
          aria-label={(visible ? "Ocultar " : "Mostrar ") + visibilityLabel}
          aria-pressed={visible}
          aria-controls={inputId}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
        </Button>
      </div>
    );
  },
);
