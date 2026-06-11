'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Filter, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import type {
  CriticalityLevel,
  OvershootBucket,
  SlaOutcome,
  TicketCategoryType,
  TicketsFilters,
} from '@/hooks/use-tickets-filters';

// ─── Catalogos UI ────────────────────────────────────────────────────────

const SLA_OUTCOMES: { value: SlaOutcome; label: string; color: string }[] = [
  { value: 'COMPLIED', label: 'Cumplido', color: 'text-success' },
  { value: 'BREACHED_RESPONSE', label: 'Breach Respuesta', color: 'text-warning' },
  { value: 'BREACHED_RESOLUTION', label: 'Breach Resolucion', color: 'text-destructive' },
  { value: 'BREACHED_BOTH', label: 'Breach Ambos', color: 'text-destructive' },
  { value: 'NO_SLA', label: 'Sin SLA', color: 'text-muted-foreground' },
];

const CRITICALITIES: { value: CriticalityLevel; label: string; color: string }[] = [
  { value: 'HIGH', label: 'Alta', color: 'text-destructive' },
  { value: 'MEDIUM', label: 'Media', color: 'text-warning' },
  { value: 'LOW', label: 'Baja', color: 'text-muted-foreground' },
];

const OVERSHOOT_BUCKETS: { value: OvershootBucket; label: string }[] = [
  { value: 'LT_1H', label: '<1h' },
  { value: 'BETWEEN_1_4H', label: '1-4h' },
  { value: 'BETWEEN_4_24H', label: '4-24h' },
  { value: 'GT_24H', label: '>24h' },
];

const CATEGORIES: { value: TicketCategoryType; label: string }[] = [
  { value: 'SUPPORT_REQUEST', label: 'Soporte' },
  { value: 'NEW_DEVELOPMENT', label: 'Desarrollo' },
];

interface ClientOption {
  id: string;
  name: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

// ─── Props ───────────────────────────────────────────────────────────────

export interface TicketsFacetsPanelProps {
  filters: TicketsFilters;
  onApply: (patch: Partial<TicketsFilters>) => void;
  onClear: () => void;
  /** Numero de facets activos (badge en el trigger). */
  activeCount: number;
}

// ─── Componente ──────────────────────────────────────────────────────────

export function TicketsFacetsPanel({ filters, onApply, onClear, activeCount }: TicketsFacetsPanelProps) {
  const { orgId } = useOrg();
  const [open, setOpen] = useState(false);

  // Estado local del form. Se commitea al onApply solo cuando el usuario
  // confirma con "Aplicar filtros". Si cancela / cierra, no se commitea.
  const [draft, setDraft] = useState<TicketsFilters>(filters);

  // Re-sync draft cuando el panel abre (refleja URL como source of truth).
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  // Cliente / Proyecto search dropdowns.
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  // Carga clientes solo cuando el dialog abre (lazy + cache simple).
  useEffect(() => {
    if (!open || !orgId || clients.length > 0) return;
    api
      .get(`/organizations/${orgId}/clients?limit=200`)
      .then((res) => {
        const list = (res.data as any)?.data || (Array.isArray(res.data) ? res.data : []);
        setClients(list);
      })
      .catch(() => setClients([]));
  }, [open, orgId, clients.length]);

  // Carga proyectos dependiendo del cliente.
  useEffect(() => {
    if (!open || !orgId) return;
    if (!draft.clientId) {
      setProjects([]);
      return;
    }
    api
      .get(`/organizations/${orgId}/projects?clientId=${draft.clientId}`)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
        setProjects(list);
      })
      .catch(() => setProjects([]));
  }, [open, orgId, draft.clientId]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients.slice(0, 50);
    return clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 50);
  }, [clients, clientSearch]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projects.slice(0, 50);
    return projects.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 50);
  }, [projects, projectSearch]);

  // ─── Toggles multi-select ──────────────────────────────────────────────
  const toggleArrayValue = <T extends string>(arr: T[], value: T): T[] => {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  };

  const handleApply = () => {
    onApply({
      slaOutcome: draft.slaOutcome,
      criticality: draft.criticality,
      overshootBucket: draft.overshootBucket,
      category: draft.category,
      clientId: draft.clientId,
      projectId: draft.projectId,
      resolvedFrom: draft.resolvedFrom,
      resolvedTo: draft.resolvedTo,
    });
    setOpen(false);
  };

  const handleClear = () => {
    setDraft({
      ...filters,
      slaOutcome: [],
      criticality: [],
      overshootBucket: null,
      category: [],
      clientId: null,
      projectId: null,
      resolvedFrom: null,
      resolvedTo: null,
    });
    onClear();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-1 h-9 shrink-0', activeCount > 0 && 'border-primary text-primary')}
        >
          <Filter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Mas filtros</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-primary text-primary-foreground w-4 h-4 text-[10px] flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mas filtros</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* 1) Resultado SLA */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Resultado SLA
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SLA_OUTCOMES.map((opt) => {
                const checked = draft.slaOutcome.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer text-xs',
                      checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        setDraft((d) => ({
                          ...d,
                          slaOutcome: toggleArrayValue(d.slaOutcome, opt.value),
                        }))
                      }
                    />
                    <span className={cn('font-medium', opt.color)}>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* 2) Criticidad */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Criticidad
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {CRITICALITIES.map((opt) => {
                const checked = draft.criticality.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer text-xs',
                      checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        setDraft((d) => ({
                          ...d,
                          criticality: toggleArrayValue(d.criticality, opt.value),
                        }))
                      }
                    />
                    <span className={cn('font-medium', opt.color)}>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* 3) Overshoot bucket — segmented (radio) */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Rango de overshoot
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {OVERSHOOT_BUCKETS.map((opt) => {
                const selected = draft.overshootBucket === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        overshootBucket: selected ? null : opt.value,
                      }))
                    }
                    className={cn(
                      'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      selected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border hover:bg-muted',
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
              {draft.overshootBucket && (
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, overshootBucket: null }))}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                  aria-label="Limpiar rango"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </section>

          {/* 4) Tipo */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tipo
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((opt) => {
                const checked = draft.category.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer text-xs',
                      checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        setDraft((d) => ({
                          ...d,
                          category: toggleArrayValue(d.category, opt.value),
                        }))
                      }
                    />
                    <span className="font-medium">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 5) Cliente */}
            <section className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cliente
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-muted/30 divide-y divide-border">
                {filteredClients.length === 0 ? (
                  <p className="px-2 py-1.5 text-[11px] text-muted-foreground text-center">
                    Sin resultados
                  </p>
                ) : (
                  filteredClients.map((c) => {
                    const selected = draft.clientId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            clientId: selected ? null : c.id,
                            projectId: null,
                          }))
                        }
                        className={cn(
                          'w-full text-left px-2 py-1.5 text-xs hover:bg-muted transition-colors',
                          selected && 'bg-primary/10 text-primary font-medium',
                        )}
                      >
                        {c.name}
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            {/* 6) Proyecto */}
            <section className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Proyecto {draft.clientId ? '' : '(elegir cliente)'}
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={draft.clientId ? 'Buscar proyecto...' : 'Seleccioná un cliente'}
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                  disabled={!draft.clientId}
                />
              </div>
              <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-muted/30 divide-y divide-border">
                {!draft.clientId ? (
                  <p className="px-2 py-1.5 text-[11px] text-muted-foreground text-center">—</p>
                ) : filteredProjects.length === 0 ? (
                  <p className="px-2 py-1.5 text-[11px] text-muted-foreground text-center">
                    Sin proyectos
                  </p>
                ) : (
                  filteredProjects.map((p) => {
                    const selected = draft.projectId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            projectId: selected ? null : p.id,
                          }))
                        }
                        className={cn(
                          'w-full text-left px-2 py-1.5 text-xs hover:bg-muted transition-colors',
                          selected && 'bg-primary/10 text-primary font-medium',
                        )}
                      >
                        {p.name}
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          {/* 7) Fechas de resolucion */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Rango de fechas de resolucion
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Desde</Label>
                <Input
                  type="date"
                  value={draft.resolvedFrom ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      resolvedFrom: e.target.value || null,
                    }))
                  }
                  className="h-8 text-xs"
                  max={draft.resolvedTo ?? undefined}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Hasta</Label>
                <Input
                  type="date"
                  value={draft.resolvedTo ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      resolvedTo: e.target.value || null,
                    }))
                  }
                  className="h-8 text-xs"
                  min={draft.resolvedFrom ?? undefined}
                />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={handleClear} type="button">
            Limpiar
          </Button>
          <Button size="sm" onClick={handleApply} type="button">
            Aplicar filtros
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Calcula cuantos facets "Mas filtros" estan activos (para el badge).
 * Excluye filtros del toolbar principal (search, criticality basico,
 * category basico, clientId) ya que esos viven afuera. Pero como en
 * este rediseño TODO vive aca, los contamos todos los del panel.
 */
export function countActiveFacets(filters: TicketsFilters): number {
  let count = 0;
  if (filters.slaOutcome.length > 0) count++;
  if (filters.criticality.length > 0) count++;
  if (filters.category.length > 0) count++;
  if (filters.overshootBucket) count++;
  if (filters.clientId) count++;
  if (filters.projectId) count++;
  if (filters.resolvedFrom || filters.resolvedTo) count++;
  return count;
}
