import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CityAutocomplete } from "@/components/city-autocomplete";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vagas/")({
  head: () => ({
    meta: [
      { title: "Vagas | Triagem de Currículos" },
      {
        name: "description",
        content:
          "Cadastre vagas com requisitos obrigatórios e desejáveis e compare automaticamente os candidatos do banco de talentos.",
      },
      { property: "og:title", content: "Vagas | Triagem de Currículos" },
      {
        property: "og:description",
        content: "Cadastro de vagas e requisitos para o ranking automático de candidatos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JobsPage,
});

const splitList = (value: string) =>
  value
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);

function JobsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    obrigatorios: "",
    desejaveis: "",
    experiencia: "0",
    formacao: "",
    localizacao: "",
    categoria: "regular",
  });

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createJob = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("jobs").insert({
        titulo: form.titulo,
        descricao: form.descricao || null,
        requisitos_obrigatorios: splitList(form.obrigatorios),
        requisitos_desejaveis: splitList(form.desejaveis),
        experiencia_minima: Number(form.experiencia) || 0,
        formacao_exigida: form.formacao || null,
        localizacao: form.localizacao || null,
        categoria: form.categoria,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vaga criada.");
      setOpen(false);
      setForm({
        titulo: "",
        descricao: "",
        obrigatorios: "",
        desejaveis: "",
        experiencia: "0",
        formacao: "",
        localizacao: "",
        categoria: "regular",
      });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vagas</h1>
          <p className="text-sm text-muted-foreground">
            Defina os requisitos e veja os candidatos mais aderentes.
          </p>
        </div>
        <Button onClick={() => setOpen((value) => !value)}>
          <Plus className="size-4" /> Nova vaga
        </Button>
      </header>

      <div className="flex flex-wrap gap-2" aria-label="Filtrar vagas por categoria">
        {([
          ["todas", "Todas"],
          ["regular", "Vagas regulares"],
          ["jovem_aprendiz", "Jovem Aprendiz"],
        ] as const).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={categoryFilter === value ? "default" : "outline"}
            onClick={() => setCategoryFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {open && (
        <Card>
          <CardHeader>
            <CardTitle>Nova vaga</CardTitle>
            <CardDescription>Separe os requisitos por vírgula ou quebra de linha.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                createJob.mutate();
              }}
            >
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="titulo">Título da vaga</Label>
                <Input
                  id="titulo"
                  required
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Select
                  value={form.categoria}
                  onValueChange={(categoria) => setForm({ ...form, categoria })}
                >
                  <SelectTrigger id="categoria"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Vaga regular</SelectItem>
                    <SelectItem value="jovem_aprendiz">Jovem Aprendiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  rows={3}
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="obrigatorios">Requisitos obrigatórios</Label>
                <Textarea
                  id="obrigatorios"
                  rows={3}
                  placeholder="Excel avançado, Inglês, CNH B"
                  value={form.obrigatorios}
                  onChange={(e) => setForm({ ...form, obrigatorios: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desejaveis">Requisitos desejáveis</Label>
                <Textarea
                  id="desejaveis"
                  rows={3}
                  placeholder="Power BI, SAP"
                  value={form.desejaveis}
                  onChange={(e) => setForm({ ...form, desejaveis: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="experiencia">Experiência mínima (anos)</Label>
                <Input
                  id="experiencia"
                  type="number"
                  min={0}
                  value={form.experiencia}
                  onChange={(e) => setForm({ ...form, experiencia: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="formacao">Formação exigida</Label>
                <Input
                  id="formacao"
                  value={form.formacao}
                  onChange={(e) => setForm({ ...form, formacao: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="localizacao">Localização</Label>
                <CityAutocomplete
                  id="localizacao"
                  value={form.localizacao}
                  onChange={(localizacao) => setForm({ ...form, localizacao })}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={createJob.isPending}>
                  {createJob.isPending ? "Salvando..." : "Salvar vaga"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando vagas...</p>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma vaga cadastrada ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {jobs.filter((job) => categoryFilter === "todas" || job.categoria === categoryFilter).map((job) => (
            <Link
              key={job.id}
              to="/vagas/$id"
              params={{ id: job.id }}
              className="rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{job.titulo}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={job.categoria === "jovem_aprendiz" ? "default" : "outline"}>
                    {job.categoria === "jovem_aprendiz" ? "Jovem Aprendiz" : "Vaga regular"}
                  </Badge>
                  <Badge variant="secondary">{job.localizacao ?? "Sem local definido"}</Badge>
                </div>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {job.descricao ?? "Sem descrição"}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(job.requisitos_obrigatorios ?? []).slice(0, 8).map((req) => (
                  <span
                    key={req}
                    className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground"
                  >
                    {req}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
