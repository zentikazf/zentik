'use client';

import { ChevronDown, Users, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MembersGroup } from '@/types/members-view';
import type { ReactNode } from 'react';

interface MembersGroupProps {
  group: MembersGroup;
  visibleMembersCount: number;
  isCollapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
  hasActiveSearch: boolean;
}

export function MembersGroupSection({
  group,
  visibleMembersCount,
  isCollapsed,
  onToggle,
  children,
  hasActiveSearch,
}: MembersGroupProps) {
  const Icon = group.type === 'team' ? Users : Building2;
  const labelCountText = hasActiveSearch
    ? `${visibleMembersCount} de ${group.count}`
    : `${group.count}`;

  return (
    <section
      aria-labelledby={`group-${group.id}-title`}
      className="mb-4 overflow-hidden rounded-xl border border-border bg-card"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        aria-controls={`group-${group.id}-content`}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h2
            id={`group-${group.id}-title`}
            className="text-sm font-semibold text-foreground"
          >
            {group.label}
          </h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {labelCountText}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            !isCollapsed && 'rotate-180',
          )}
        />
      </button>

      {!isCollapsed && (
        <div
          id={`group-${group.id}-content`}
          className="border-t border-border px-4 py-4"
        >
          {visibleMembersCount === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              {hasActiveSearch
                ? '(sin coincidencias en este grupo)'
                : 'Sin miembros en este grupo.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {children}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
