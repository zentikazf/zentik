'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import { cn } from '@/lib/utils';

interface Label {
 id: string;
 name: string;
 color: string;
}

interface LabelSelectorProps {
 taskId: string;
 currentLabels: Array<{ label: Label }>;
 onLabelsChanged?: () => void;
}

export function LabelSelector({ taskId, currentLabels, onLabelsChanged }: LabelSelectorProps) {
 const { orgId } = useOrg();
 const [allLabels, setAllLabels] = useState<Label[]>([]);
 const [open, setOpen] = useState(false);
 const [loading, setLoading] = useState(false);

 const selectedIds = new Set(currentLabels.map((tl) => tl.label.id));

 const loadLabels = useCallback(async () => {
 if (!orgId) return;
 setLoading(true);
 try {
 const res = await api.get(`/organizations/${orgId}/labels`);
 setAllLabels(Array.isArray(res.data) ? res.data : []);
 } catch {} finally {
 setLoading(false);
 }
 }, [orgId]);

 useEffect(() => {
 if (open) loadLabels();
 }, [open, loadLabels]);

 const toggleLabel = async (labelId: string) => {
 try {
 if (selectedIds.has(labelId)) {
 await api.delete(`/tasks/${taskId}/labels/${labelId}`);
 } else {
 await api.post(`/tasks/${taskId}/labels`, { labelId });
 }
 onLabelsChanged?.();
 } catch {
 toast.error('Error', 'No se pudo actualizar la etiqueta');
 }
 };

 return (
 <div className="space-y-2">
 {/* Current labels */}
 <div className="flex flex-wrap gap-1.5">
 {currentLabels.map((tl) => (
 <span
 key={tl.label.id}
 className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
 style={{ backgroundColor: tl.label.color }}
 >
 {tl.label.name}
 </span>
 ))}
 </div>

 {/* Add label */}
 <Popover open={open} onOpenChange={setOpen}>
 <PopoverTrigger asChild>
 <Button variant="outline"size="sm"className="h-7 rounded-full text-xs">
 <Plus className="mr-1 h-3 w-3"/>
 Etiqueta
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-56 p-2"align="start">
 {loading ? (
 <p className="p-2 text-center text-xs text-muted-foreground">Cargando...</p>
 ) : allLabels.length === 0 ? (
 <p className="p-2 text-center text-xs text-muted-foreground">No hay etiquetas. Crea una desde Configuración.</p>
 ) : (
 <div className="space-y-0.5">
 {allLabels.map((label) => {
 const selected = selectedIds.has(label.id);
 return (
 <button
 key={label.id}
 onClick={() => toggleLabel(label.id)}
 className={cn(
 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
 selected
 ? 'bg-primary/10'
 : 'hover:bg-muted',
 )}
 >
 <div className="h-3.5 w-3.5 rounded-full"style={{ backgroundColor: label.color }} />
 <span className="flex-1 text-left text-foreground">{label.name}</span>
 {selected && <Check className="h-3.5 w-3.5 text-primary"/>}
 </button>
 );
 })}
 </div>
 )}
 </PopoverContent>
 </Popover>
 </div>
 );
}
