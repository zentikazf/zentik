'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from '@/components/ui/dialog';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import { TASK_TYPE_OPTIONS } from '@/lib/task-utils';

interface CreateTaskDialogProps {
 projectId: string;
 open: boolean;
 onOpenChange: (open: boolean) => void;
 onCreated: (task: any) => void;
 defaultBoardColumnId?: string;
 defaultSprintId?: string;
 defaultStatus?: string;
 parentTaskId?: string;
}

export function CreateTaskDialog({
 projectId,
 open,
 onOpenChange,
 onCreated,
 defaultBoardColumnId,
 defaultSprintId,
 defaultStatus,
 parentTaskId,
}: CreateTaskDialogProps) {
 const { orgId } = useOrg();
 const [saving, setSaving] = useState(false);
 const [showMore, setShowMore] = useState(false);
 const [members, setMembers] = useState<any[]>([]);
 const [labels, setLabels] = useState<any[]>([]);
 const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
 const [roleId, setRoleId] = useState('none');
 const [showAllMembers, setShowAllMembers] = useState(false);

 // Form state
 const [title, setTitle] = useState('');
 const [description, setDescription] = useState('');
 const [priority, setPriority] = useState('MEDIUM');
 const [taskType, setTaskType] = useState<'PROJECT' | 'SUPPORT'>('PROJECT');
 const [estimatedHours, setEstimatedHours] = useState('');
 const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

 // Expandable fields
 const [dueDate, setDueDate] = useState('');
 const [startDate, setStartDate] = useState('');
 const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);

 // Load project members, sprints, labels, and org roles
 useEffect(() => {
 if (!open) return;
 const load = async () => {
 try {
 const [membersRes, labelsRes, rolesRes] = await Promise.all([
 api.get(`/projects/${projectId}/members`).catch(() => ({ data: [] })),
 api.get(`/projects/${projectId}/labels`).catch(() => ({ data: [] })),
 orgId ? api.get(`/organizations/${orgId}/roles`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
 ]);
 setMembers(Array.isArray(membersRes.data) ? membersRes.data : membersRes.data?.data || []);
 setLabels(Array.isArray(labelsRes.data) ? labelsRes.data : labelsRes.data?.data || []);
 const rolesList = Array.isArray(rolesRes.data) ? rolesRes.data : rolesRes.data?.data || [];
 setRoles(rolesList.filter((r: any) => r.name !== 'Owner'));
 } catch {
 // silent
 }
 };
 load();
 }, [open, projectId, orgId]);

 // Reset form when dialog opens
 useEffect(() => {
 if (open) {
 setTitle('');
 setDescription('');
 setPriority('MEDIUM');
 setTaskType('PROJECT');
 setEstimatedHours('');
 setAssigneeIds([]);
 setDueDate('');
 setStartDate('');
 setSelectedLabelIds([]);
 setRoleId('none');
 setShowAllMembers(false);
 setShowMore(false);
 }
 }, [open, defaultSprintId]);

 const handleSubmit = async () => {
 if (!title.trim()) return;
 setSaving(true);

 try {
 const payload: any = {
 title: title.trim(),
 description: description.trim() || undefined,
 priority,
 type: taskType,
 status: defaultStatus || 'BACKLOG',
 };

 if (estimatedHours) payload.estimatedHours = Number(estimatedHours);
 if (assigneeIds.length) payload.assigneeIds = assigneeIds;
 if (defaultBoardColumnId) payload.boardColumnId = defaultBoardColumnId;
 if (dueDate) payload.dueDate = new Date(dueDate).toISOString();
 if (startDate) payload.startDate = new Date(startDate).toISOString();
 if (selectedLabelIds.length) payload.labelIds = selectedLabelIds;
 if (roleId && roleId !== 'none') payload.roleId = roleId;

 const url = parentTaskId
 ? `/tasks/${parentTaskId}/subtasks`
 : `/projects/${projectId}/tasks`;

 const res = await api.post(url, payload);
 toast.success(parentTaskId ? 'Subtarea creada' : 'Tarea creada');
 onCreated(res.data);
 onOpenChange(false);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al crear la tarea';
 toast.error('Error', message);
 } finally {
 setSaving(false);
 }
 };

 const toggleAssignee = (userId: string) => {
 setAssigneeIds((prev) =>
 prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
 );
 };

 const toggleLabel = (labelId: string) => {
 setSelectedLabelIds((prev) =>
 prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId],
 );
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-lg">
 <DialogHeader>
 <DialogTitle>
 {parentTaskId ? 'Nueva Subtarea' : 'Nueva Tarea'}
 </DialogTitle>
 </DialogHeader>

 <div className="space-y-4 py-2">
 {/* Title */}
 <div className="space-y-2">
 <Label>Título *</Label>
 <Input
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 placeholder="Nombre de la tarea"
 autoFocus
 />
 </div>

 {/* Description */}
 <div className="space-y-2">
 <Label>Descripción</Label>
 <Textarea
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Describe la tarea..."
 rows={3}
 />
 </div>

 {/* Priority */}
 <div className="space-y-2">
 <Label>Prioridad</Label>
 <Select value={priority} onValueChange={setPriority}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="URGENT">Urgente</SelectItem>
 <SelectItem value="HIGH">Alta</SelectItem>
 <SelectItem value="MEDIUM">Media</SelectItem>
 <SelectItem value="LOW">Baja</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* Task type */}
 <div className="space-y-2">
 <Label>Tipo de tarea</Label>
 <Select value={taskType} onValueChange={(v) => setTaskType(v as 'PROJECT' | 'SUPPORT')}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {TASK_TYPE_OPTIONS.map((opt) => (
 <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <p className="text-[11px] text-muted-foreground">
 Las tareas de tipo Soporte descuentan horas del cliente al completarse.
 </p>
 </div>

 {/* Estimated hours */}
 <div className="space-y-2">
 <Label>Horas estimadas</Label>
 <Input
 type="number"
 value={estimatedHours}
 onChange={(e) => setEstimatedHours(e.target.value)}
 placeholder="Ej: 8"
 min={0}
 />
 </div>

 {/* Rol destino */}
 {roles.length > 0 && (
 <div className="space-y-2">
 <Label>Rol destino</Label>
 <Select value={roleId} onValueChange={(v) => { setRoleId(v); setShowAllMembers(false); }}>
 <SelectTrigger>
 <SelectValue placeholder="Sin rol específico"/>
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="none">Sin rol específico</SelectItem>
 {roles.map((r) => (
 <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}

 {/* Assignees (filtrado por rol) */}
 {members.length > 0 && (() => {
 const hasRole = roleId && roleId !== 'none';
 const selectedRoleName = roles.find((r) => r.id === roleId)?.name;
 const filteredMembers = hasRole && !showAllMembers
 ? members.filter((m) => {
 const user = m.user || m;
 return user.role?.id === roleId;
 })
 : members;

 return (
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label>Asignar a</Label>
 {hasRole && (
 <button
 type="button"
 onClick={() => setShowAllMembers(!showAllMembers)}
 className="flex items-center gap-1 text-[11px] text-primary hover:text-primary"
 >
 <Filter className="h-3 w-3"/>
 {showAllMembers ? `Solo ${selectedRoleName}` : 'Ver todos'}
 </button>
 )}
 </div>
 <div className="flex flex-wrap gap-2">
 {filteredMembers.map((m) => {
 const user = m.user || m;
 const isSelected = assigneeIds.includes(user.id);
 const roleName = user.role?.name;
 return (
 <button
 key={user.id}
 type="button"
 onClick={() => toggleAssignee(user.id)}
 className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
 isSelected
 ? 'bg-primary text-primary-foreground'
 : 'bg-muted text-muted-foreground hover:bg-muted'
 }`}
 >
 {user.name || user.email}
 {roleName && (
 <span className={isSelected ? 'ml-1 opacity-75' : 'ml-1 text-muted-foreground'}>
 · {roleName}
 </span>
 )}
 </button>
 );
 })}
 {filteredMembers.length === 0 && hasRole && (
 <p className="text-xs text-muted-foreground">
 No hay miembros con rol {selectedRoleName}.{' '}
 <button type="button"onClick={() => setShowAllMembers(true)} className="text-primary hover:underline">
 Ver todos
 </button>
 </p>
 )}
 </div>
 </div>
 );
 })()}

 {/* Expandable section */}
 <button
 type="button"
 onClick={() => setShowMore(!showMore)}
 className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary"
 >
 {showMore ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
 {showMore ? 'Menos opciones' : 'Más opciones'}
 </button>

 {showMore && (
 <div className="space-y-4 border-t pt-4">
 {/* Dates row */}
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-2">
 <Label>Fecha de inicio</Label>
 <Input
 type="date"
 value={startDate}
 onChange={(e) => setStartDate(e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label>Fecha límite</Label>
 <Input
 type="date"
 value={dueDate}
 onChange={(e) => setDueDate(e.target.value)}
 />
 </div>
 </div>

 {/* Labels */}
 {labels.length > 0 && (
 <div className="space-y-2">
 <Label>Etiquetas</Label>
 <div className="flex flex-wrap gap-2">
 {labels.map((label) => {
 const isSelected = selectedLabelIds.includes(label.id);
 return (
 <button
 key={label.id}
 type="button"
 onClick={() => toggleLabel(label.id)}
 className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
 isSelected
 ? 'ring-2 ring-blue-500 ring-offset-1'
 : 'opacity-70 hover:opacity-100'
 }`}
 style={{
 backgroundColor: label.color ? `${label.color}20` : '#e5e7eb',
 color: label.color || '#6b7280',
 }}
 >
 {label.name}
 </button>
 );
 })}
 </div>
 </div>
 )}
 </div>
 )}
 </div>

 <DialogFooter>
 <Button variant="outline"onClick={() => onOpenChange(false)}>
 Cancelar
 </Button>
 <Button onClick={handleSubmit} disabled={saving || !title.trim()}>
 {saving ? 'Creando...' : parentTaskId ? 'Crear Subtarea' : 'Crear Tarea'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
