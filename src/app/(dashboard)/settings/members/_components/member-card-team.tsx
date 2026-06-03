'use client';

import { useState } from 'react';
import { MoreVertical, Mail, UserCog, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { MemberCard } from '@/types/members-view';

interface MemberCardTeamProps {
  member: MemberCard;
  onResendInvitation: (member: MemberCard) => void;
  onEditRole?: (member: MemberCard) => void;
  onRemove?: (member: MemberCard) => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
  if (days < 365) return `hace ${Math.floor(days / 30)} meses`;
  return `hace ${Math.floor(days / 365)} años`;
}

export function MemberCardTeam({
  member,
  onResendInvitation,
  onEditRole,
  onRemove,
}: MemberCardTeamProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted/40',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.name} />}
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {getInitials(member.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold text-foreground"
            title={member.name}
          >
            {member.name}
          </p>
          <p
            className="truncate text-xs text-muted-foreground"
            title={member.email}
          >
            {member.email}
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            aria-label="Más acciones"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-8 z-20 w-48 rounded-xl border border-border bg-card p-1 shadow-lg">
                {!member.emailVerified && (
                  <button
                    type="button"
                    onClick={() => {
                      onResendInvitation(member);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-foreground hover:bg-muted"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Reenviar invitación
                  </button>
                )}
                {onEditRole && (
                  <button
                    type="button"
                    onClick={() => {
                      onEditRole(member);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-foreground hover:bg-muted"
                  >
                    <UserCog className="h-3.5 w-3.5" />
                    Editar rol
                  </button>
                )}
                {onRemove && (
                  <button
                    type="button"
                    onClick={() => {
                      onRemove(member);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Quitar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          {member.roleName}
        </span>
        {!member.emailVerified && (
          <span
            className="rounded-md bg-warning/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-warning"
            title="Email pendiente de verificación"
          >
            Pendiente
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {formatRelative(member.joinedAt)}
        </span>
      </div>
    </div>
  );
}
