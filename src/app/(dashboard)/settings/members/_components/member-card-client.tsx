'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { MemberCard } from '@/types/members-view';

interface MemberCardClientProps {
  member: MemberCard;
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

export function MemberCardClient({ member }: MemberCardClientProps) {
  const href = member.clientId ? `/clients/${member.clientId}` : '/clients';

  return (
    <Link
      href={href}
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/40',
      )}
      title={`Editar en perfil del cliente ${member.clientName ?? ''}`}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.name} />}
          <AvatarFallback className="bg-info/10 text-xs font-semibold text-info">
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
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-info/10 px-2 py-0.5 text-[10px] font-medium text-info">
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
    </Link>
  );
}
