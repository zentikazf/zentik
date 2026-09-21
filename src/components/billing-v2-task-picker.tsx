"use client";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getToken } from "@/lib/api-client";
import type { DevelopmentEntry } from "@/lib/billing-v2";

interface TaskOption {
  id: string;
  title: string;
  status: string;
  type: string;
  estimatedHours: number | null;
  hourlyRate: number | null;
  billable: boolean;
  project: { name: string };
}
export function BillingTaskPicker({
  open,
  onOpenChange,
  endpoint,
  period,
  existing,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  endpoint: string;
  period: string;
  existing: DevelopmentEntry[];
  onImport: (entries: DevelopmentEntry[]) => void;
}) {
  const [tasks, setTasks] = useState<TaskOption[]>([]),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [chosen, setChosen] = useState<Record<string, DevelopmentEntry>>({});
  useEffect(() => {
    if (open) {
      setChosen({});
      setPage(1);
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const token = getToken();
    fetch(endpoint + "&mode=tasks&page=" + page, {
      credentials: "include",
      headers: token ? { Authorization: "Bearer " + token } : {},
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error?.message || "No se pudieron cargar las tareas",
          );
        return body.data;
      })
      .then((data) => {
        if (data.currency !== "PYG")
          throw new Error("El cliente no tiene tarifa en guaraníes");
        setTasks(data.items);
        setTotal(data.total);
        setLimit(data.limit);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setTasks([]);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, page, endpoint]);
  const selected = Object.values(chosen);
  const valid =
    selected.length > 0 &&
    selected.every(
      (e) =>
        e.hours > 0 &&
        Number.isFinite(e.hours) &&
        e.rate >= 0 &&
        Number.isFinite(e.rate),
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Seleccionar tareas · Fortaleza</DialogTitle>
          <DialogDescription>
            Selecciona tareas y confirma las horas a facturar. Las horas
            estimadas se usan como sugerencia.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">Cargando tareas…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Seleccionar</th>
                  <th className="p-2">Tarea / proyecto</th>
                  <th className="p-2">Estado</th>
                  <th className="p-2">Horas</th>
                  <th className="p-2">Gs. por hora</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const id = "task:" + task.id;
                  const already = existing.some((entry) => entry.id === id);
                  const entry = chosen[id];
                  return (
                    <tr key={task.id} className="border-t">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          aria-label={"Seleccionar " + task.title}
                          disabled={already}
                          checked={already || !!entry}
                          onChange={(event) =>
                            setChosen((current) => {
                              const next = { ...current };
                              if (event.target.checked)
                                next[id] = {
                                  id,
                                  label: task.title,
                                  hours: task.estimatedHours ?? 0,
                                  rate: task.hourlyRate ?? 0,
                                  workedOn: period + "-01",
                                  source: "ZENTIK",
                                };
                              else delete next[id];
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="p-2">
                        <p>{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.project.name}
                          {already ? " · Agregada" : ""}
                        </p>
                      </td>
                      <td className="p-2">{task.status}</td>
                      <td className="p-2">
                        <Input
                          className="w-24"
                          aria-label={"Horas de " + task.title}
                          disabled={!entry}
                          type="number"
                          min="0.01"
                          max="100000"
                          step="0.01"
                          value={entry?.hours ?? task.estimatedHours ?? 0}
                          onChange={(event) =>
                            setChosen((current) => ({
                              ...current,
                              [id]: {
                                ...current[id],
                                hours: Number(event.target.value),
                              },
                            }))
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          className="w-32"
                          aria-label={"Tarifa de " + task.title}
                          disabled={!entry}
                          type="number"
                          min="0"
                          max="1000000000"
                          value={entry?.rate ?? task.hourlyRate ?? 0}
                          onChange={(event) =>
                            setChosen((current) => ({
                              ...current,
                              [id]: {
                                ...current[id],
                                rate: Number(event.target.value),
                              },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!tasks.length && !error && (
              <p className="p-4 text-sm">No hay tareas asociadas al cliente.</p>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 text-sm">
          <Button
            variant="outline"
            disabled={page === 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span>
            {total} tareas · Página {page}
          </span>
          <Button
            variant="outline"
            disabled={page * limit >= total || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valid || existing.length + selected.length > 1000}
            onClick={() => {
              onImport(selected);
              onOpenChange(false);
            }}
          >
            Agregar seleccionadas ({selected.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
