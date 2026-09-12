import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { resolveCity, suggestCities } from "@/lib/maps.functions";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Suggestion = { placeId: string; label: string };

export function CityAutocomplete({
  id,
  value,
  onChange,
  placeholder = "Digite uma cidade",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const suggest = useServerFn(suggestCities);
  const resolve = useServerFn(resolveCity);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(false);
  const token = useRef(crypto.randomUUID());
  const requestId = useRef(0);

  useEffect(() => {
    const query = value.trim();
    if (selected || query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const currentRequest = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await suggest({ data: { input: query, sessionToken: token.current } });
        if (currentRequest === requestId.current) {
          setSuggestions(result);
          setOpen(result.length > 0);
        }
      } catch (error) {
        if (currentRequest === requestId.current) {
          setSuggestions([]);
          toast.error(error instanceof Error ? error.message : "Não foi possível buscar cidades.");
        }
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [value, selected, suggest]);

  async function choose(item: Suggestion) {
    setLoading(true);
    try {
      const result = await resolve({ data: { placeId: item.placeId, sessionToken: token.current } });
      setSelected(true);
      onChange(result.city);
      setSuggestions([]);
      setOpen(false);
      token.current = crypto.randomUUID();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível selecionar a cidade.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <MapPin className="pointer-events-none absolute left-3 top-2.5 z-10 size-4 text-muted-foreground" />
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className="pl-9 pr-9"
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(event) => {
          setSelected(false);
          onChange(event.target.value);
        }}
      />
      {loading && <Loader2 className="absolute right-3 top-2.5 size-4 animate-spin text-muted-foreground" />}
      {open && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          {suggestions.map((item) => (
            <button
              key={item.placeId}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
            >
              <Check className="size-4 opacity-40" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}