'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import { cn } from '@/lib/utils';

const presetColors = [
 '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E',
 '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
 '#A855F7', '#EC4899', '#F43F5E', '#78716C',
];

interface Label {
 id: string;
 name: string;
 color: string;
}

export function LabelManager() {
 const { orgId } = useOrg();
 const [labels, setLabels] = useState<Label[]>([]);
 const [loading, setLoading] = useState(true);
 const [creating, setCreating] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [name, setName] = useState('');
 const [color, setColor] = useState(presetColors[0]);

 const loadLabels = useCallback(async () => {
 if (!orgId) return;
 try {
 const res = await api.get(`/organizations/${orgId}/labels`);
 setLabels(Array.isArray(res.data) ? res.data : []);
 } catch {} finally {
 setLoading(false);
 }
 }, [orgId]);

 useEffect(() => { loadLabels(); }, [loadLabels]);

 const handleSave = async () => {
 if (!name.trim() || !orgId) return;

 try {
 if (editingId) {
 await api.patch(`/labels/${editingId}`, { name: name.trim(), color });
 toast.success('Etiqueta actualizada');
 } else {
 await api.post(`/organizations/${orgId}/labels`, { name: name.trim(), color });
 toast.success('Etiqueta creada');
 }
 resetForm();
 await loadLabels();
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al guardar';
 toast.error('Error', message);
 }
 };

 const handleEdit = (label: Label) => {
 setEditingId(label.id);
 setName(label.name);
 setColor(label.color);
 setCreating(true);
 };

 const handleDelete = async (labelId: string) => {
 try {
 await api.delete(`/labels/${labelId}`);
 toast.success('Etiqueta eliminada');
 await loadLabels();
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al eliminar';
 toast.error('Error', message);
 }
 };

 const resetForm = () => {
 setCreating(false);
 setEditingId(null);
 setName('');
 setColor(presetColors[0]);
 };

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="text-lg font-semibold text-foreground">Etiquetas</h3>
 {!creating && (
 <Button size="sm"variant="outline"className="rounded-full"onClick={() => setCreating(true)}>
 <Plus className="mr-1 h-4 w-4"/>
 Nueva Etiqueta
 </Button>
 )}
 </div>

 {/* Create/Edit Form */}
 {creating && (
 <div className="rounded-xl border border-border bg-muted p-4">
 <div className="flex items-center gap-3">
 <div className="h-8 w-8 shrink-0 rounded-full"style={{ backgroundColor: color }} />
 <Input
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="Nombre de la etiqueta"
 className="flex-1"
 onKeyDown={(e) => e.key === 'Enter' && handleSave()}
 />
 <Button size="sm"className="rounded-full"onClick={handleSave}>
 <Check className="mr-1 h-4 w-4"/>
 {editingId ? 'Guardar' : 'Crear'}
 </Button>
 <Button size="sm"variant="ghost"className="rounded-full"onClick={resetForm}>
 <X className="h-4 w-4"/>
 </Button>
 </div>
 <div className="mt-3 flex flex-wrap gap-2">
 {presetColors.map((c) => (
 <button
 key={c}
 onClick={() => setColor(c)}
 className={cn(
 'h-7 w-7 rounded-full transition-all',
 color === c ? 'ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-gray-800' : 'hover:scale-110',
 )}
 style={{ backgroundColor: c }}
 />
 ))}
 </div>
 </div>
 )}

 {/* Labels List */}
 {loading ? (
 <p className="text-sm text-muted-foreground">Cargando...</p>
 ) : labels.length === 0 ? (
 <p className="text-sm text-muted-foreground">No hay etiquetas creadas</p>
 ) : (
 <div className="space-y-2">
 {labels.map((label) => (
 <div
 key={label.id}
 className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
 >
 <div className="flex items-center gap-3">
 <div className="h-5 w-5 rounded-full"style={{ backgroundColor: label.color }} />
 <span className="text-sm font-medium text-foreground">{label.name}</span>
 </div>
 <div className="flex items-center gap-1">
 <button
 onClick={() => handleEdit(label)}
 className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-muted-foreground"
 >
 <Pencil className="h-4 w-4"/>
 </button>
 <button
 onClick={() => handleDelete(label.id)}
 className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
 >
 <Trash2 className="h-4 w-4"/>
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
