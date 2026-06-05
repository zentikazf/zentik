'use client';

import { UsersRound, SearchX, AlertCircle, UserPlus } from 'lucide-react';

type EmptyStateVariant = 'no-members' | 'no-search-results' | 'no-filter-results';

interface EmptyStateProps {
  variant: EmptyStateVariant;
  onAddMember?: () => void;
  onClearSearch?: () => void;
}

export function EmptyState({ variant, onAddMember, onClearSearch }: EmptyStateProps) {
  if (variant === 'no-members') {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <UsersRound className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          Solo vos estás acá
        </h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Invitá a tu equipo para colaborar en proyectos, tickets y reportes.
        </p>
        {onAddMember && (
          <button
            type="button"
            onClick={onAddMember}
            className="mt-6 flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <UserPlus className="h-4 w-4" />
            Agregar miembro
          </button>
        )}
      </div>
    );
  }

  if (variant === 'no-search-results') {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <SearchX className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          Sin coincidencias
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Probá con menos términos o quitar el filtro.
        </p>
        {onClearSearch && (
          <button
            type="button"
            onClick={onClearSearch}
            className="mt-4 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-muted"
          >
            Limpiar búsqueda
          </button>
        )}
      </div>
    );
  }

  // no-filter-results
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <AlertCircle className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">
        Sin miembros que coincidan
      </h3>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        Cambiá el filtro para ver más resultados.
      </p>
    </div>
  );
}
