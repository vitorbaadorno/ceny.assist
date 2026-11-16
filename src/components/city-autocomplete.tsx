import { useServerFn } from "@tanstack/react-start";
import { useEffect, useId, useRef, useState } from "react";
import { Check, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { resolveCity, suggestCities } from "@/lib/maps.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Suggestion = { placeId: string; label: string };

export function CityAutocomplete({
  id,
  disabled = false,
  value,
  onChange,
  onSelect,
  placeholder = "Digite uma cidade",
}: {
  id?: string;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
  placeholder?: string;
}) {
  const suggest = useServerFn(suggestCities);
  const resolve = useServerFn(resolveCity);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [unavailable, setUnavailable] = useState(false);
  const listId = useId();
  const token = useRef(crypto.randomUUID());
  const requestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const currentRequest = ++requestId.current;
    const query = value.trim();
    if (disabled || selected || query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await suggest({ data: { input: query, sessionToken: token.current } });
        if (!cancelled && currentRequest === requestId.current) {
          setSuggestions(result);
          setActiveIndex(-1);
          setUnavailable(false);
          setOpen(result.length > 0);
        }
      } catch {
        if (!cancelled && currentRequest === requestId.current) {
          setSuggestions([]);
          setOpen(false);
          setUnavailable(true);
        }
      } finally {
        if (!cancelled && currentRequest === requestId.current) setLoading(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      cancelled = true;
    };
  }, [value, selected, suggest, disabled]);

  async function choose(item: Suggestion) {
    const currentRequest = ++requestId.current;
    setLoading(true);
    try {
      const result = await resolve({
        data: { placeId: item.placeId, sessionToken: token.current },
      });
      if (currentRequest !== requestId.current) return;
      setSelected(true);
      onChange(result.city);
      onSelect?.(result.city);
      setSuggestions([]);
      setOpen(false);
      token.current = crypto.randomUUID();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível selecionar a cidade.");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  return (
    <div className="relative">
      <MapPin className="pointer-events-none absolute left-3 top-2.5 z-10 size-4 text-muted-foreground" />
      <Input
        disabled={disabled}
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-label={id ? undefined : "Cidade"}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        aria-describedby={`${listId}-status`}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && suggestions.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) =>
              event.key === "ArrowDown"
                ? (index + 1) % suggestions.length
                : index <= 0
                  ? suggestions.length - 1
                  : index - 1,
            );
          }
          if (event.key === "Enter" && open && activeIndex >= 0 && suggestions[activeIndex]) {
            event.preventDefault();
            void choose(suggestions[activeIndex]);
          }
        }}
        className="pl-9 pr-9"
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(event) => {
          setSelected(false);
          onChange(event.target.value);
        }}
      />
      {loading && (
        <Loader2 className="absolute right-3 top-2.5 size-4 animate-spin text-muted-foreground" />
      )}
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Cidades sugeridas"
          className="absolute z-40 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md"
        >
          {suggestions.map((item, index) => (
            <Button
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              tabIndex={-1}
              key={item.placeId}
              type="button"
              variant="ghost"
              className={cn(
                "h-auto w-full justify-start rounded-none px-3 py-2 text-left font-normal",
                index === activeIndex && "bg-accent",
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
            >
              <Check className="size-4 opacity-40" />
              <span>{item.label}</span>
            </Button>
          ))}
        </div>
      )}
      <p id={`${listId}-status`} role="status" className="mt-1 text-xs text-muted-foreground">
        {unavailable
          ? "Sugestões indisponíveis. Você pode digitar cidade e UF manualmente."
          : loading
            ? "Buscando cidades…"
            : "Digite cidade e UF ou use as setas para escolher uma sugestão."}
      </p>
    </div>
  );
}
