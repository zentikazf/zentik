'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, Gauge, Info } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { slaService } from '@/services/sla.service';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import {
  CRITICALITY_DEFAULT_CONFIG,
  CRITICALITY_LABEL,
  CRITICALITY_VALUES,
  FALLBACK_CRITICALITY,
} from '@/lib/criticality';
import type { CriticalityConfig, SlaCriticality } from '@/types/sla.types';

/** Tope del backend (`MAX_CRITICALITY_LEVEL` en el DTO). */
const MAX_LEVEL = 99;

interface CriticalityDraft {
  clientLabel: string;
  clientVisible: boolean;
  level: string;
}

type DraftMap = Record<string, CriticalityDraft>;

/**
 * Draft de una fila. Si la organización todavía no configuró esa criticidad, se
 * pinta con los defaults del backend (`CRITICALITY_DEFAULT_CONFIG`): el PATCH es
 * un upsert, así que editarla la crea. Sin esto, una org sin seed corrido vería
 * una tabla vacía y no tendría por dónde empezar.
 */
function toDraft(criticality: SlaCriticality, config?: CriticalityConfig): CriticalityDraft {
  const defaults = CRITICALITY_DEFAULT_CONFIG[criticality];
  return {
    clientLabel: config?.clientLabel ?? '',
    clientVisible: config?.clientVisible ?? defaults.clientVisible,
    level: String(config?.level ?? defaults.level),
  };
}

function isDirty(draft: CriticalityDraft, base: CriticalityDraft): boolean {
  return (
    draft.clientLabel !== base.clientLabel ||
    draft.clientVisible !== base.clientVisible ||
    draft.level !== base.level
  );
}

/**
 * Presentación y visibilidad de las criticidades (#42 Fase 2).
 *
 * Lo que se configura acá NO cambia el SLA: cambia **qué ve el cliente y cómo lo
 * ve**. Es la palanca que mueve el portal entre el modo 2A (el cliente elige la
 * criticidad) y el 2B (no elige y entra la default) sin migración ni deploy.
 */
export default function CriticalityConfigPage() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState<CriticalityConfig[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [savingRow, setSavingRow] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await slaService.listCriticalityConfigs(orgId);
      const rows = Array.isArray(res.data) ? res.data : [];
      setConfigs(rows);
      setDrafts(
        CRITICALITY_VALUES.reduce<DraftMap>((acc, criticality) => {
          acc[criticality] = toDraft(
            criticality,
            rows.find((row) => row.criticality === criticality),
          );
          return acc;
        }, {}),
      );
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo cargar la configuración de criticidades'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const configOf = (criticality: SlaCriticality) =>
    configs.find((row) => row.criticality === criticality);

  const patchDraft = (criticality: SlaCriticality, patch: Partial<CriticalityDraft>) => {
    setDrafts((prev) => ({ ...prev, [criticality]: { ...prev[criticality], ...patch } }));
  };

  const handleSave = async (criticality: SlaCriticality) => {
    if (!orgId) return;
    const draft = drafts[criticality];
    if (!draft) return;

    const level = Number(draft.level);
    if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
      toast.error('Datos inválidos', `El nivel debe ser un entero entre 1 y ${MAX_LEVEL}`);
      return;
    }
    const clientLabel = draft.clientLabel.trim();
    if (clientLabel.length > 60) {
      toast.error('Datos inválidos', 'La etiqueta no puede exceder 60 caracteres');
      return;
    }

    setSavingRow(criticality);
    try {
      await slaService.updateCriticalityConfig(orgId, criticality, {
        // Vacío ⇒ `null`: limpia la etiqueta y el cliente vuelve a ver el nombre interno.
        clientLabel: clientLabel || null,
        clientVisible: draft.clientVisible,
        level,
      });
      toast.success('Guardado', `Criticidad "${CRITICALITY_LABEL[criticality]}" actualizada`);
      await load();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo guardar la criticidad'));
    } finally {
      setSavingRow(null);
    }
  };

  /**
   * Marcar la default es EXCLUYENTE y lo resuelve el backend en una transacción:
   * por eso va como acción propia e inmediata, y no dentro del draft de la fila.
   */
  const handleMakeDefault = async (criticality: SlaCriticality) => {
    if (!orgId) return;
    setSavingRow(criticality);
    try {
      await slaService.updateCriticalityConfig(orgId, criticality, { isDefault: true });
      toast.success(
        'Criticidad por defecto',
        `Los tickets sin criticidad entrarán como "${CRITICALITY_LABEL[criticality]}"`,
      );
      await load();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo marcar la criticidad por defecto'));
    } finally {
      setSavingRow(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const noneVisible = CRITICALITY_VALUES.every((c) => !drafts[c]?.clientVisible);
  const defaultCriticality =
    configs.find((row) => row.isDefault)?.criticality ?? FALLBACK_CRITICALITY;

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Criticidades</h2>
        </div>

        <p className="text-xs text-muted-foreground">
          La criticidad no se crea ni se borra: acá se define cómo la ve el cliente en el portal, si
          la puede elegir y en qué orden aparece. El nombre interno lo sigue viendo el equipo.
        </p>

        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Si ninguna criticidad está habilitada, el cliente no la elige y los tickets entran con la
            criticidad por defecto.
            {noneVisible && (
              <strong className="ml-1 text-warning">
                Ahora mismo no hay ninguna habilitada: el portal no muestra el selector y todo entra
                como &quot;{CRITICALITY_LABEL[defaultCriticality]}&quot;.
              </strong>
            )}
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">Criticidad</TableHead>
              <TableHead>Etiqueta para el cliente</TableHead>
              <TableHead className="w-[90px]">Nivel</TableHead>
              <TableHead className="w-[110px]">Visible</TableHead>
              <TableHead className="w-[150px]">Por defecto</TableHead>
              <TableHead className="w-[110px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CRITICALITY_VALUES.map((criticality) => {
              const config = configOf(criticality);
              const draft = drafts[criticality] ?? toDraft(criticality, config);
              const dirty = isDirty(draft, toDraft(criticality, config));
              const saving = savingRow === criticality;

              return (
                <TableRow key={criticality}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1">
                      <span>{config?.displayName ?? CRITICALITY_LABEL[criticality]}</span>
                      {!config && (
                        <Badge variant="secondary" className="w-fit text-[10px]">
                          Sin configurar
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <Input
                      value={draft.clientLabel}
                      onChange={(e) => patchDraft(criticality, { clientLabel: e.target.value })}
                      placeholder={CRITICALITY_LABEL[criticality]}
                      maxLength={60}
                      className="h-8 text-sm"
                      aria-label={`Etiqueta para el cliente de ${CRITICALITY_LABEL[criticality]}`}
                    />
                  </TableCell>

                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      max={MAX_LEVEL}
                      value={draft.level}
                      onChange={(e) => patchDraft(criticality, { level: e.target.value })}
                      className="h-8 w-16 text-sm"
                      aria-label={`Nivel de ${CRITICALITY_LABEL[criticality]}`}
                    />
                  </TableCell>

                  <TableCell>
                    <Switch
                      checked={draft.clientVisible}
                      onCheckedChange={(checked) =>
                        patchDraft(criticality, { clientVisible: checked })
                      }
                      aria-label={`Visible para el cliente: ${CRITICALITY_LABEL[criticality]}`}
                    />
                  </TableCell>

                  <TableCell>
                    {config?.isDefault ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Predeterminada
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={saving}
                        onClick={() => handleMakeDefault(criticality)}
                      >
                        Marcar
                      </Button>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={!dirty || saving}
                      onClick={() => handleSave(criticality)}
                    >
                      {saving ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <p className="text-[11px] text-muted-foreground">
          El nivel ordena el selector del portal: mayor = más urgente. La criticidad por defecto es
          excluyente — marcar una desmarca la anterior.
        </p>
      </section>
    </div>
  );
}
