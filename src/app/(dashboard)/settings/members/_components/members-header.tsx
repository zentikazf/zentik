'use client';

import { Search, UserPlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MembersFilter } from '@/types/members-view';

interface MembersHeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  filter: MembersFilter;
  onFilterChange: (filter: MembersFilter) => void;
  totalCount: number;
  pendingCount: number;
  onAddMember: () => void;
}

const FILTERS: { id: MembersFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'team', label: 'Team' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'active', label: 'Activos' },
];

export function MembersHeader({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  totalCount,
  pendingCount,
  onAddMember,
}: MembersHeaderProps) {
  return (
    <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-6 border-b border-border bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-bold text-foreground">Miembros</h1>
          <p className="text-xs text-muted-foreground">
            {totalCount} {totalCount === 1 ? 'miembro' : 'miembros'}
            {pendingCount > 0 && (
              <>
                {' · '}
                <span className="text-warning">
                  {pendingCount} {pendingCount === 1 ? 'pendiente' : 'pendientes'}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="w-full rounded-xl border border-border bg-card px-9 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring sm:w-72"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onAddMember}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <UserPlus className="h-4 w-4" />
            Agregar miembro
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterChange(f.id)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === f.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
