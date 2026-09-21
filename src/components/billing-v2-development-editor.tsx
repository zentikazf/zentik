"use client";

import { useState } from "react";
import { ListPlus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DevelopmentEntry } from "@/lib/billing-v2";

export function DevelopmentEditor({
  entries,
  period,
  onChange,
  onSelectTasks,
}: {
  entries: DevelopmentEntry[];
  period: string;
  onChange: (entries: DevelopmentEntry[]) => void;
  onSelectTasks: () => void;
}) {
  const [label, setLabel] = useState("");
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("");
  const [date, setDate] = useState(`${period}-01`);
  const lastDay = new Date(
    Number(period.slice(0, 4)),
    Number(period.slice(5, 7)),
    0,
  ).getDate();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Tareas de desarrollo · Tarifa en Gs. por hora.
        </p>
        <Button variant="outline" onClick={onSelectTasks}>
          <ListPlus className="mr-2 h-4 w-4" />
          Seleccionar tareas de Zentik
        </Button>
      </div>
      <form
        className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          onChange([
            ...entries,
            {
              id: `manual:${crypto.randomUUID()}`,
              label: label.trim(),
              hours: Number(hours),
              rate: Number(rate),
              workedOn: date,
              source: "MANUAL",
            },
          ]);
          setLabel("");
          setHours("");
        }}
      >
        <label className="space-y-1 text-sm">
          Tarea
          <Input
            aria-label="Tarea manual"
            required
            maxLength={500}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          Fecha de trabajo
          <Input
            aria-label="Fecha de trabajo"
            type="date"
            required
            min={`${period}-01`}
            max={`${period}-${lastDay}`}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          Horas
          <Input
            aria-label="Horas manuales"
            type="number"
            required
            min="0.01"
            max="100000"
            step="0.01"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          Gs. por hora
          <Input
            aria-label="Tarifa manual"
            type="number"
            required
            min="0"
            max="1000000000"
            step="1"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </label>
        <Button
          type="submit"
          disabled={!label.trim() || entries.length >= 1000}
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar tarea
        </Button>
      </form>
      {entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-5"
            >
              <div className="text-sm">
                <p className="font-medium">{entry.label}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.workedOn} ·{" "}
                  {entry.source === "ZENTIK" ? "Zentik" : "Manual"}
                </p>
              </div>
              <label className="space-y-1 text-sm">
                Horas
                <Input
                  aria-label={`Horas: ${entry.label}`}
                  type="number"
                  min="0.01"
                  max="100000"
                  step="0.01"
                  value={entry.hours}
                  onChange={(e) =>
                    onChange(
                      entries.map((row) =>
                        row.id === entry.id
                          ? { ...row, hours: Number(e.target.value) }
                          : row,
                      ),
                    )
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                Gs. por hora
                <Input
                  aria-label={`Tarifa: ${entry.label}`}
                  type="number"
                  min="0"
                  max="1000000000"
                  value={entry.rate}
                  onChange={(e) =>
                    onChange(
                      entries.map((row) =>
                        row.id === entry.id
                          ? { ...row, rate: Number(e.target.value) }
                          : row,
                      ),
                    )
                  }
                />
              </label>
              <span className="text-sm tabular-nums">
                {Math.round(entry.hours * entry.rate).toLocaleString("es-PY")}{" "}
                Gs.
              </span>
              <Button
                variant="ghost"
                aria-label={`Quitar ${entry.label}`}
                onClick={() =>
                  onChange(entries.filter((row) => row.id !== entry.id))
                }
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Quitar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
