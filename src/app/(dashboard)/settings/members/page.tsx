'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Copy, Eye, EyeOff } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { useMembersData } from './_hooks/use-members-data';
import { useCollapsedSections } from './_hooks/use-collapsed-sections';
import { MembersHeader } from './_components/members-header';
import { MembersGroupSection } from './_components/members-group';
import { MemberCardTeam } from './_components/member-card-team';
import { MemberCardClient } from './_components/member-card-client';
import { EmptyState } from './_components/empty-state';
import { MembersSkeleton } from './_components/members-skeleton';
import type { MemberCard, MembersFilter } from '@/types/members-view';

const ALLOWED_ROLES = ['Owner', 'Project Manager'];

// ─────────────────────────────────────────────────────────────────────
// Modal "Agregar miembro" — CONSERVADO TAL CUAL del codigo anterior.
// Spec del harness (Feature #7) explicita: NO se rediseña este modal.
// ─────────────────────────────────────────────────────────────────────
function CreateMemberDialog({
 open,
 onClose,
 orgId,
 roles,
 onCreated,
}: {
 open: boolean;
 onClose: () => void;
 orgId: string;
 roles: any[];
 onCreated: () => void;
}) {
 const [name, setName] = useState('');
 const [email, setEmail] = useState('');
 const [roleId, setRoleId] = useState('');
 const [saving, setSaving] = useState(false);
 const [result, setResult] = useState<{
		 temporaryPassword?: string;
		 activationMode?: 'email-sent' | 'temp-password';
		 member?: any;
	 } | null>(null);
 const [showPassword, setShowPassword] = useState(false);

 const assignableRoles = roles.filter((r) => r.name !== 'Owner');

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!name || !email || !roleId) return;

 setSaving(true);
 try {
 const res = await api.post(`/organizations/${orgId}/members`, { name, email, roleId });
 setResult(res.data);
 if (res.data?.activationMode === 'email-sent') {
		 toast.success('Invitación enviada', `${name} va a recibir un email para activar su cuenta`);
 } else {
		 toast.success('Miembro creado', `${name} fue agregado. Compartile la contraseña temporal.`);
 }
 onCreated();
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al crear miembro';
 toast.error('Error', message);
 } finally {
 setSaving(false);
 }
 };

 const handleClose = () => {
 setName('');
 setEmail('');
 setRoleId('');
 setResult(null);
 setShowPassword(false);
 onClose();
 };

 const copyPassword = () => {
 if (result?.temporaryPassword) {
 navigator.clipboard.writeText(result.temporaryPassword);
 toast.success('Copiado', 'Contraseña temporal copiada al portapapeles');
 }
 };

 if (!open) return null;

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
 <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl">
 <div className="mb-5 flex items-center justify-between">
 <h2 className="text-lg font-semibold text-foreground">
 {result
		 ? result.activationMode === 'email-sent'
			 ? '¡Invitación enviada!'
			 : 'Miembro creado'
		 : 'Agregar Miembro'}
 </h2>
 <button onClick={handleClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
 <X className="h-4 w-4"/>
 </button>
 </div>

 {result ? (
 <div className="space-y-4">
		 {result.activationMode === 'email-sent' ? (
			 <>
				 <div className="rounded-xl bg-success/10 border border-success/30 p-4">
					 <p className="text-sm font-semibold text-success">
						 Email de activación enviado a {email}
					 </p>
					 <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
						 El usuario recibirá un correo con un link único para activar su cuenta y definir su propia contraseña.
						 El link expira en 48 horas.
					 </p>
				 </div>
				 <div className="rounded-xl bg-info/5 border border-info/30 p-3">
					 <p className="text-xs text-muted-foreground leading-relaxed">
						 <strong className="text-foreground">¿No le llegó?</strong> Pedile que revise carpeta de spam,
						 o reenviá la invitación desde la lista de miembros. Cuentas corporativas pueden tardar más.
					 </p>
				 </div>
			 </>
		 ) : (
			 <>
				 <div className="rounded-xl bg-warning/10 border border-warning/30 p-4">
					 <p className="text-sm font-semibold text-warning">
						 Cuenta creada en modo manual
					 </p>
					 <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
						 No pudimos enviar el correo de activación. Compartile la contraseña temporal
						 a <strong className="text-foreground">{email}</strong> por un canal seguro. Deberá cambiarla en el primer inicio de sesión.
					 </p>
				 </div>
				 {result.temporaryPassword && (
					 <div className="space-y-2">
						 <label className="text-xs font-medium text-muted-foreground">Contraseña temporal</label>
						 <div className="flex items-center gap-2 rounded-xl bg-muted p-3">
							 <code className="flex-1 text-sm font-mono text-foreground select-all">
								 {showPassword ? result.temporaryPassword : '••••••••••'}
							 </code>
							 <button
								 onClick={() => setShowPassword(!showPassword)}
								 className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
								 type="button"
							 >
								 {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
							 </button>
							 <button
								 onClick={copyPassword}
								 className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
								 type="button"
							 >
								 <Copy className="h-4 w-4"/>
							 </button>
						 </div>
						 <p className="text-xs text-warning">
							 No se va a volver a mostrar — copiala antes de cerrar.
						 </p>
					 </div>
				 )}
			 </>
		 )}

 <button
 onClick={handleClose}
 className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
 >
		 Listo
 </button>
 </div>
 ) : (
 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nombre completo</label>
 <input
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="Juan Pérez"
 required
 className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
 />
 </div>
 <div>
 <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Correo electrónico</label>
 <input
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 placeholder="juan@empresa.com"
 required
 className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
 />
 </div>
 <div>
 <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Rol</label>
 <Select value={roleId} onValueChange={setRoleId}>
 <SelectTrigger className="w-full rounded-xl">
 <SelectValue placeholder="Seleccionar rol"/>
 </SelectTrigger>
 <SelectContent>
 {assignableRoles.map((r) => (
 <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <p className="text-xs text-muted-foreground">
 Se generará una contraseña temporal automáticamente. El usuario deberá cambiarla al iniciar sesión por primera vez.
 </p>
 <div className="flex gap-3 pt-1">
 <button type="button" onClick={handleClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
 Cancelar
 </button>
 <button type="submit" disabled={saving || !name || !email || !roleId} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
 {saving ? 'Creando...' : 'Crear Usuario'}
 </button>
 </div>
 </form>
 )}
 </div>
 </div>
 );
}

// ─────────────────────────────────────────────────────────────────────
// Pagina principal — Variante A "Library" del rediseño (Feature #7)
// ─────────────────────────────────────────────────────────────────────
export default function MembersSettingsPage() {
  const router = useRouter();
  const { orgId } = useOrg();
  const { organizations, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MembersFilter>('all');

  const currentOrgRole = organizations?.find((o) => o.id === orgId)?.roleName;
  const hasAccess = !!currentOrgRole && ALLOWED_ROLES.includes(currentOrgRole);

  // Guard de rol: solo Owner y Project Manager
  useEffect(() => {
    if (authLoading) return;
    if (currentOrgRole === undefined) return; // todavia sin orgId resuelto
    if (!hasAccess) {
      toast.error('Sin acceso', 'No tenés acceso a esta sección.');
      router.replace('/dashboard');
    }
  }, [authLoading, currentOrgRole, hasAccess, router]);

  // Cargar roles (para el modal de agregar miembro)
  useEffect(() => {
    if (!orgId || !hasAccess) return;
    api
      .get(`/organizations/${orgId}/roles`)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setRoles(list);
      })
      .catch(() => {});
  }, [orgId, hasAccess]);

  const { groups, isLoading, error, refetch } = useMembersData(
    hasAccess ? orgId ?? undefined : undefined,
  );

  // Lista de ids de clientes para inicialmente colapsados (team queda expandido)
  const clientIds = useMemo(
    () => groups.filter((g) => g.type === 'client').map((g) => g.id),
    [groups],
  );

  const { isCollapsed, toggle, reconcile } = useCollapsedSections(clientIds);

  // Sincronizar el set de colapsados con los ids vigentes (limpieza de basura)
  useEffect(() => {
    if (groups.length === 0) return;
    reconcile(groups.map((g) => g.id));
  }, [groups, reconcile]);

  const trimmedQuery = query.trim().toLowerCase();
  const hasActiveSearch = trimmedQuery.length >= 3;

  // Filtrado en memoria
  const filteredGroups = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        members: group.members.filter((member) => {
          if (filter === 'team' && group.type !== 'team') return false;
          if (filter === 'pending' && member.emailVerified) return false;
          if (filter === 'active' && !member.emailVerified) return false;
          if (hasActiveSearch) {
            return (
              member.name.toLowerCase().includes(trimmedQuery) ||
              member.email.toLowerCase().includes(trimmedQuery)
            );
          }
          return true;
        }),
      }))
      .filter((group) => {
        if (filter === 'team' && group.type !== 'team') return false;
        return true;
      });
  }, [groups, filter, hasActiveSearch, trimmedQuery]);

  const totalCount = groups.reduce((acc, g) => acc + g.count, 0);
  const pendingCount = groups.reduce(
    (acc, g) => acc + g.members.filter((m) => !m.emailVerified).length,
    0,
  );

  const handleResendInvitation = async (member: MemberCard) => {
    try {
      await api.post('/auth/resend-verification', { userId: member.id });
      toast.success('Email reenviado', `Revisá la bandeja de ${member.email}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo reenviar';
      toast.error('Error', msg);
    }
  };

  const handleRemove = async (member: MemberCard) => {
    if (!orgId || !member.membershipId) return;
    if (!window.confirm(`¿Quitar a ${member.name} de la organización?`)) return;
    try {
      await api.delete(`/organizations/${orgId}/members/${member.membershipId}`);
      toast.success('Miembro eliminado', `${member.name} fue removido`);
      refetch();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al eliminar';
      toast.error('Error', msg);
    }
  };

  // ── Renders ──────────────────────────────────────────────────────

  if (!hasAccess) {
    return (
      <div className="p-6">
        <MembersSkeleton />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <MembersSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <h2 className="font-semibold text-foreground">No pudimos cargar los miembros</h2>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-4 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-muted"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="p-6">
        <EmptyState variant="no-members" onAddMember={() => setShowCreate(true)} />
        <CreateMemberDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          orgId={orgId!}
          roles={roles}
          onCreated={() => {
            setShowCreate(false);
            refetch();
          }}
        />
      </div>
    );
  }

  const allFilteredEmpty = filteredGroups.every((g) => g.members.length === 0);

  return (
    <div className="p-6">
      <MembersHeader
        query={query}
        onQueryChange={setQuery}
        filter={filter}
        onFilterChange={setFilter}
        totalCount={totalCount}
        pendingCount={pendingCount}
        onAddMember={() => setShowCreate(true)}
      />

      {allFilteredEmpty && hasActiveSearch ? (
        <EmptyState variant="no-search-results" onClearSearch={() => setQuery('')} />
      ) : allFilteredEmpty ? (
        <EmptyState variant="no-filter-results" />
      ) : (
        filteredGroups.map((group) => {
          // Si hay busqueda activa, todas las secciones se auto-expanden
          const collapsed = hasActiveSearch ? false : isCollapsed(group.id);
          return (
            <MembersGroupSection
              key={group.id}
              group={group}
              visibleMembersCount={group.members.length}
              isCollapsed={collapsed}
              onToggle={() => toggle(group.id)}
              hasActiveSearch={hasActiveSearch}
            >
              {group.members.map((member) =>
                member.source === 'team' ? (
                  <MemberCardTeam
                    key={member.id}
                    member={member}
                    onResendInvitation={handleResendInvitation}
                    onRemove={handleRemove}
                  />
                ) : (
                  <MemberCardClient key={`${member.clientId}-${member.id}`} member={member} />
                ),
              )}
            </MembersGroupSection>
          );
        })
      )}

      <CreateMemberDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        orgId={orgId!}
        roles={roles}
        onCreated={() => {
          setShowCreate(false);
          refetch();
        }}
      />
    </div>
  );
}
