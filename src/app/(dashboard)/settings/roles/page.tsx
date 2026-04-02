'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from '@/components/ui/dialog';
import {
 Plus,
 Shield,
 Edit2,
 Trash2,
 KeyRound,
 Users,
 AlertTriangle,
 Save,
 Sparkles,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import { ROLE_PERMISSION_SUGGESTIONS } from '@/types';

interface Permission {
 id: string;
 action: string;
 resource: string;
 description?: string;
}

interface Role {
 id: string;
 name: string;
 description?: string;
 isDefault: boolean;
 isSystem: boolean;
 _count?: { organizationMembers: number };
 permissions?: Permission[];
}

const resourceLabels: Record<string, string> = {
 project: 'Proyectos',
 task: 'Tareas',
 sprint: 'Sprints',
 board: 'Tableros',
 member: 'Miembros',
 role: 'Roles',
 file: 'Archivos',
 invoice: 'Facturas',
 organization: 'Organización',
 report: 'Reportes',
 subscription: 'Suscripción',
 notification: 'Notificaciones',
 channel: 'Canales',
 time_entry: 'Tiempo',
};

const actionLabels: Record<string, string> = {
 create: 'Crear',
 read: 'Ver',
 update: 'Editar',
 delete: 'Eliminar',
 manage: 'Administrar',
 assign: 'Asignar',
 invite: 'Invitar',
 export: 'Exportar',
};

export default function RolesSettingsPage() {
 const { orgId } = useOrg();
 const [roles, setRoles] = useState<Role[]>([]);
 const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
 const [loading, setLoading] = useState(true);

 const [roleDialogOpen, setRoleDialogOpen] = useState(false);
 const [editingRole, setEditingRole] = useState<Role | null>(null);
 const [roleForm, setRoleForm] = useState({ name: '', description: '' });
 const [savingRole, setSavingRole] = useState(false);

 const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
 const [deletingRole, setDeletingRole] = useState<Role | null>(null);
 const [deleting, setDeleting] = useState(false);

 const [permDialogOpen, setPermDialogOpen] = useState(false);
 const [selectedRole, setSelectedRole] = useState<Role | null>(null);
 const [rolePermissionIds, setRolePermissionIds] = useState<string[]>([]);
 const [permissionsLoading, setPermissionsLoading] = useState(false);
 const [savingPermissions, setSavingPermissions] = useState(false);

 useEffect(() => {
 if (orgId) {
 loadRoles();
 loadAllPermissions();
 }
 }, [orgId]);

 const loadRoles = async () => {
 if (!orgId) return;
 setLoading(true);
 try {
 const res = await api.get(`/organizations/${orgId}/roles`);
 setRoles(Array.isArray(res.data) ? res.data : res.data?.data || []);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al cargar roles';
 toast.error('Error', message);
 } finally {
 setLoading(false);
 }
 };

 const loadAllPermissions = async () => {
 try {
 const res = await api.get<Permission[]>('/permissions');
 setAllPermissions(Array.isArray(res.data) ? res.data : []);
 } catch {}
 };

 const openCreateDialog = () => {
 setEditingRole(null);
 setRoleForm({ name: '', description: '' });
 setRoleDialogOpen(true);
 };

 const openEditDialog = (role: Role) => {
 setEditingRole(role);
 setRoleForm({ name: role.name, description: role.description || '' });
 setRoleDialogOpen(true);
 };

 const handleSaveRole = async () => {
 if (!orgId || !roleForm.name.trim()) return;
 setSavingRole(true);
 try {
 if (editingRole) {
 await api.patch(`/organizations/${orgId}/roles/${editingRole.id}`, {
 name: roleForm.name.trim(),
 description: roleForm.description.trim() || undefined,
 });
 toast.success('Rol actualizado', `El rol"${roleForm.name}"ha sido actualizado`);
 } else {
 await api.post(`/organizations/${orgId}/roles`, {
 name: roleForm.name.trim(),
 description: roleForm.description.trim() || undefined,
 });
 toast.success('Rol creado', `El rol"${roleForm.name}"ha sido creado exitosamente`);
 }
 setRoleDialogOpen(false);
 loadRoles();
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al guardar el rol';
 toast.error('Error', message);
 } finally {
 setSavingRole(false);
 }
 };

 const openDeleteDialog = (role: Role) => {
 setDeletingRole(role);
 setDeleteDialogOpen(true);
 };

 const handleDeleteRole = async () => {
 if (!orgId || !deletingRole) return;
 setDeleting(true);
 try {
 await api.delete(`/organizations/${orgId}/roles/${deletingRole.id}`);
 toast.success('Rol eliminado', `El rol"${deletingRole.name}"ha sido eliminado`);
 setDeleteDialogOpen(false);
 if (selectedRole?.id === deletingRole.id) {
 setSelectedRole(null);
 setRolePermissionIds([]);
 }
 loadRoles();
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'No se pudo eliminar el rol';
 toast.error('Error', message);
 } finally {
 setDeleting(false);
 }
 };

 const selectRole = async (role: Role) => {
 setSelectedRole(role);
 setPermDialogOpen(true);
 setPermissionsLoading(true);
 try {
 const res = await api.get<Permission[]>(`/organizations/${orgId}/roles/${role.id}/perms`);
 const perms = Array.isArray(res.data) ? res.data : [];
 setRolePermissionIds(perms.map((p) => p.id));
 } catch {
 setRolePermissionIds([]);
 } finally {
 setPermissionsLoading(false);
 }
 };

 const togglePermission = (permId: string) => {
 setRolePermissionIds((prev) =>
 prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId],
 );
 };

 const handleSavePermissions = async () => {
 if (!orgId || !selectedRole) return;
 setSavingPermissions(true);
 try {
 await api.patch(`/organizations/${orgId}/roles/${selectedRole.id}/perms`, {
 permissionIds: rolePermissionIds,
 });
 toast.success('Permisos actualizados', `Los permisos de"${selectedRole.name}"han sido guardados`);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al guardar permisos';
 toast.error('Error', message);
 } finally {
 setSavingPermissions(false);
 }
 };

 const groupedPermissions = allPermissions.reduce(
 (acc, perm) => {
 const resource = perm.resource;
 if (!acc[resource]) acc[resource] = [];
 acc[resource].push(perm);
 return acc;
 },
 {} as Record<string, Permission[]>,
 );

 if (loading) {
 return (
 <div className="space-y-5">
 <Skeleton className="h-10 w-48 rounded-xl"/>
 <div className="space-y-3">
 {Array.from({ length: 4 }).map((_, i) => (
 <Skeleton key={i} className="h-24 rounded-xl"/>
 ))}
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-7">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-[22px] font-semibold text-foreground">Roles y Permisos</h1>
 <p className="mt-1 text-sm text-muted-foreground">
 Administra los roles y controla el acceso de tu equipo
 </p>
 </div>
 <Button onClick={openCreateDialog} className="rounded-full">
 <Plus className="mr-2 h-4 w-4"/>
 Crear Nuevo Rol
 </Button>
 </div>

 {/* Roles List */}
 <div className="space-y-4">
 {roles.map((role) => {
 const memberCount = role._count?.organizationMembers ?? 0;

 return (
 <div
 key={role.id}
 className="rounded-xl border border-border bg-card p-6"
 >
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-4">
 <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
 <Shield className="h-6 w-6 text-primary"/>
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h3 className="text-[15px] font-semibold text-foreground">{role.name}</h3>
 {role.isSystem && (
 <Badge className="bg-info/10 text-info">Sistema</Badge>
 )}
 {role.isDefault && (
 <Badge className="bg-primary/10 text-primary">Por defecto</Badge>
 )}
 </div>
 <p className="mt-1 text-sm text-muted-foreground">
 {role.description || 'Sin descripción'}
 </p>
 <div className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
 <Users className="h-3.5 w-3.5"/>
 {memberCount} {memberCount === 1 ? 'miembro' : 'miembros'}
 </div>
 </div>
 </div>

 <div className="flex items-center gap-1">
 <Button
 variant="outline"
 size="sm"
 className="rounded-full"
 onClick={() => selectRole(role)}
 >
 <KeyRound className="mr-1.5 h-3.5 w-3.5"/>
 Permisos
 </Button>
 <button
 onClick={() => openEditDialog(role)}
 disabled={role.isSystem}
 className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-muted-foreground disabled:opacity-40"
 title={role.isSystem ? 'No puedes editar un rol del sistema' : 'Editar rol'}
 >
 <Edit2 className="h-4 w-4"/>
 </button>
 <button
 onClick={() => openDeleteDialog(role)}
 disabled={role.isSystem}
 className="flex h-9 w-9 items-center justify-center rounded-full text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
 title={role.isSystem ? 'No puedes eliminar un rol del sistema' : 'Eliminar rol'}
 >
 <Trash2 className="h-4 w-4"/>
 </button>
 </div>
 </div>
 </div>
 );
 })}

 {roles.length === 0 && (
 <div className="flex flex-col items-center rounded-xl bg-card py-16 text-center">
 <Shield className="mb-3 h-10 w-10 text-muted-foreground/50"/>
 <p className="text-muted-foreground">No hay roles configurados</p>
 <Button className="mt-4 rounded-full"onClick={openCreateDialog}>
 <Plus className="mr-2 h-4 w-4"/> Crear primer rol
 </Button>
 </div>
 )}
 </div>

 {/* Permissions Dialog */}
 <Dialog open={permDialogOpen} onOpenChange={(open) => {
 setPermDialogOpen(open);
 if (!open) { setSelectedRole(null); setRolePermissionIds([]); }
 }}>
 <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>
 <div className="flex items-center gap-2">
 <KeyRound className="h-5 w-5 text-primary"/>
 Permisos de &quot;{selectedRole?.name}&quot;
 </div>
 </DialogTitle>
 </DialogHeader>

 {selectedRole?.isSystem && (
 <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
 <AlertTriangle className="h-4 w-4 shrink-0"/>
 Los permisos de un rol del sistema no se pueden modificar
 </div>
 )}

 {permissionsLoading ? (
 <div className="grid gap-4 md:grid-cols-2 py-4">
 {Array.from({ length: 6 }).map((_, i) => (
 <Skeleton key={i} className="h-32 rounded-xl"/>
 ))}
 </div>
 ) : (
 <div className="grid gap-4 md:grid-cols-2 py-2">
 {Object.entries(groupedPermissions).map(([resource, perms]) => (
 <div key={resource} className="rounded-xl border border-border p-4">
 <h4 className="mb-3 text-[15px] font-semibold text-foreground">
 {resourceLabels[resource] || resource}
 </h4>
 <div className="space-y-2.5">
 {perms.map((perm) => (
 <label key={perm.id} className="flex cursor-pointer items-center gap-2.5">
 <Checkbox
 checked={rolePermissionIds.includes(perm.id)}
 onCheckedChange={() => togglePermission(perm.id)}
 disabled={selectedRole?.isSystem}
 />
 <span className="text-sm text-foreground">
 {actionLabels[perm.action] || perm.action}
 </span>
 </label>
 ))}
 </div>
 </div>
 ))}

 {Object.keys(groupedPermissions).length === 0 && (
 <div className="col-span-2 py-12 text-center text-sm text-muted-foreground">
 No hay permisos configurados en el sistema
 </div>
 )}
 </div>
 )}

 <DialogFooter>
 {selectedRole && !selectedRole.isSystem && ROLE_PERMISSION_SUGGESTIONS[selectedRole.name] && (
 <Button
 variant="outline"
 className="rounded-full mr-auto"
 onClick={() => {
 const suggestions = ROLE_PERMISSION_SUGGESTIONS[selectedRole.name];
 if (!suggestions) return;
 const matchedIds = allPermissions
 .filter((p) => suggestions.some((s) => s.action === p.action && s.resource === p.resource))
 .map((p) => p.id);
 setRolePermissionIds(matchedIds);
 toast.success('Sugeridos aplicados', `Se seleccionaron ${matchedIds.length} permisos para"${selectedRole.name}"`);
 }}
 >
 <Sparkles className="mr-1.5 h-3.5 w-3.5"/>
 Aplicar sugeridos
 </Button>
 )}
 <Button variant="outline"onClick={() => setPermDialogOpen(false)}>Cancelar</Button>
 <Button
 onClick={handleSavePermissions}
 disabled={savingPermissions || !!selectedRole?.isSystem}
 >
 <Save className="mr-1.5 h-3.5 w-3.5"/>
 {savingPermissions ? 'Guardando...' : 'Guardar Permisos'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Create/Edit Role Dialog */}
 <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>
 {editingRole ? 'Editar Rol' : 'Crear Nuevo Rol'}
 </DialogTitle>
 </DialogHeader>
 <div className="space-y-4 py-2">
 <div className="space-y-2">
 <Label htmlFor="role-name">Nombre del rol</Label>
 <Input
 id="role-name"
 value={roleForm.name}
 onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
 placeholder="Ej: Editor, Viewer, Manager..."
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="role-desc">Descripción (opcional)</Label>
 <Textarea
 id="role-desc"
 value={roleForm.description}
 onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
 placeholder="Describe brevemente qué puede hacer este rol..."
 rows={3}
 />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline"onClick={() => setRoleDialogOpen(false)}>
 Cancelar
 </Button>
 <Button onClick={handleSaveRole} disabled={savingRole || !roleForm.name.trim()}>
 {savingRole ? 'Guardando...' : editingRole ? 'Guardar Cambios' : 'Crear Rol'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Delete Confirmation Dialog */}
 <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Eliminar Rol</DialogTitle>
 </DialogHeader>
 <div className="py-4">
 <p className="text-sm text-muted-foreground">
 ¿Estás seguro de que quieres eliminar el rol{' '}
 <span className="font-semibold text-foreground">&quot;{deletingRole?.name}&quot;</span>?
 Esta acción no se puede deshacer.
 </p>
 {(deletingRole?._count?.organizationMembers ?? 0) > 0 && (
 <div className="mt-3 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
 <AlertTriangle className="h-4 w-4 shrink-0"/>
 Este rol tiene {deletingRole?._count?.organizationMembers} miembro(s) asignado(s)
 </div>
 )}
 </div>
 <DialogFooter>
 <Button variant="outline"onClick={() => setDeleteDialogOpen(false)}>
 Cancelar
 </Button>
 <Button variant="destructive"onClick={handleDeleteRole} disabled={deleting}>
 {deleting ? 'Eliminando...' : 'Eliminar Rol'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
