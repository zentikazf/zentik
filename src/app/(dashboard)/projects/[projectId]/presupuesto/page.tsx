'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, Calculator, ArrowLeft, ListTodo } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';

interface BudgetItem {
 id: string;
 description: string;
 category: string | null;
 hours: number;
 hourlyRate: number;
 amount: number;
 order: number;
}

function formatPYG(amount: number): string {
 return `₲${amount.toLocaleString('es-PY')}`;
}

export default function PresupuestoPage() {
 const { projectId } = useParams<{ projectId: string }>();
 const [items, setItems] = useState<BudgetItem[]>([]);
 const [total, setTotal] = useState(0);
 const [loading, setLoading] = useState(true);
 const [project, setProject] = useState<any>(null);
 const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

 useEffect(() => {
 loadBudget();
 loadProject();
 }, [projectId]);

 const loadProject = async () => {
 try {
 const res = await api.get(`/projects/${projectId}`);
 setProject(res.data);
 } catch {}
 };

 const loadBudget = async () => {
 try {
 const res = await api.get(`/projects/${projectId}/budget`);
 const data = res.data;
 setItems(
 (data.items || []).map((item: any) => ({
 ...item,
 hours: Number(item.hours),
 hourlyRate: Number(item.hourlyRate),
 amount: Number(item.amount),
 })),
 );
 setTotal(Number(data.total || 0));
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al cargar presupuesto';
 toast.error('Error', message);
 } finally {
 setLoading(false);
 }
 };

 const addItem = async () => {
 try {
 const res = await api.post(`/projects/${projectId}/budget`, {
 description: '',
 hours: 0,
 hourlyRate: 0,
 });
 const newItem = {
 ...res.data,
 hours: Number(res.data.hours),
 hourlyRate: Number(res.data.hourlyRate),
 amount: Number(res.data.amount),
 };
 setItems((prev) => [...prev, newItem]);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al agregar línea';
 toast.error('Error', message);
 }
 };

 const deleteItem = async (itemId: string) => {
 try {
 await api.delete(`/projects/${projectId}/budget/${itemId}`);
 setItems((prev) => prev.filter((i) => i.id !== itemId));
 // Recalculate total
 setTotal((prev) => {
 const deleted = items.find((i) => i.id === itemId);
 return prev - (deleted?.amount || 0);
 });
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al eliminar';
 toast.error('Error', message);
 }
 };

 const updateField = useCallback(
 (itemId: string, field: 'description' | 'hours' | 'hourlyRate', value: string) => {
 // Update local state immediately
 setItems((prev) =>
 prev.map((item) => {
 if (item.id !== itemId) return item;
 const updated = { ...item };

 if (field === 'description') {
 updated.description = value;
 } else if (field === 'hours') {
 updated.hours = Number(value) || 0;
 updated.amount = updated.hours * updated.hourlyRate;
 } else if (field === 'hourlyRate') {
 updated.hourlyRate = Number(value) || 0;
 updated.amount = updated.hours * updated.hourlyRate;
 }

 return updated;
 }),
 );

 // Recalculate total
 setItems((currentItems) => {
 const newTotal = currentItems.reduce((sum, i) => sum + i.amount, 0);
 setTotal(newTotal);
 return currentItems;
 });

 // Debounced PATCH
 const timerKey = `${itemId}-${field}`;
 if (debounceTimers.current[timerKey]) {
 clearTimeout(debounceTimers.current[timerKey]);
 }

 debounceTimers.current[timerKey] = setTimeout(async () => {
 try {
 const payload: Record<string, any> = {};
 if (field === 'description') {
 payload.description = value;
 } else if (field === 'hours') {
 payload.hours = Number(value) || 0;
 } else if (field === 'hourlyRate') {
 payload.hourlyRate = Number(value) || 0;
 }
 await api.patch(`/projects/${projectId}/budget/${itemId}`, payload);
 } catch {
 // Silent — will show on next load
 }
 delete debounceTimers.current[timerKey];
 }, 500);
 },
 [projectId],
 );

 const convertToTask = async (item: BudgetItem) => {
 if (!item.description.trim()) {
 toast.error('Error', 'La descripción del item no puede estar vacía para crear una tarea');
 return;
 }
 try {
 await api.post(`/projects/${projectId}/tasks`, {
 title: item.description,
 description: `Creada desde presupuesto — ${item.hours}h × ₲${item.hourlyRate.toLocaleString('es-PY')} = ${formatPYG(item.amount)}`,
 priority: 'MEDIUM',
 });
 toast.success('Tarea creada', `"${item.description}"fue agregada como tarea del proyecto`);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al crear tarea';
 toast.error('Error', message);
 }
 };

 if (loading) {
 return (
 <div className="space-y-4">
 <Skeleton className="h-10 w-64"/>
 <Skeleton className="h-[300px] rounded-xl"/>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Total Badge */}
 <div className="flex items-center justify-end">
 <div className="rounded-full bg-primary/10 px-4 py-2">
 <span className="text-sm font-medium text-primary">
 Total: {formatPYG(total)}
 </span>
 </div>
 </div>

 {/* Budget Table */}
 <div className="overflow-x-auto rounded-xl border border-border bg-card">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
 <th className="px-5 py-4 w-[45%]">Descripción</th>
 <th className="px-5 py-4 w-[15%]">Horas</th>
 <th className="px-5 py-4 w-[18%]">₲/hora</th>
 <th className="px-5 py-4 w-[17%]">Total</th>
 <th className="px-5 py-4 w-[5%]"></th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {items.map((item) => (
 <tr key={item.id} className="group transition-colors hover:bg-muted/50">
 <td className="px-5 py-2">
 <Input
 value={item.description}
 onChange={(e) => updateField(item.id, 'description', e.target.value)}
 placeholder="Descripción del item..."
 className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
 />
 </td>
 <td className="px-5 py-2">
 <Input
 type="number"
 value={item.hours || ''}
 onChange={(e) => updateField(item.id, 'hours', e.target.value)}
 placeholder="0"
 min={0}
 className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 w-20"
 />
 </td>
 <td className="px-5 py-2">
 <Input
 type="number"
 value={item.hourlyRate || ''}
 onChange={(e) => updateField(item.id, 'hourlyRate', e.target.value)}
 placeholder="0"
 min={0}
 className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 w-28"
 />
 </td>
 <td className="px-5 py-2 font-medium text-foreground">
 {formatPYG(item.amount)}
 </td>
 <td className="px-5 py-2">
 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
 <button
 onClick={() => convertToTask(item)}
 title="Crear tarea desde este item"
 className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/50 hover:bg-primary/10 hover:text-primary "
 >
 <ListTodo className="h-3.5 w-3.5"/>
 </button>
 <button
 onClick={() => deleteItem(item.id)}
 className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
 >
 <Trash2 className="h-3.5 w-3.5"/>
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>

 {/* Total row */}
 <tfoot>
 <tr className="border-t-2 border-border bg-muted/50">
 <td className="px-5 py-4 font-semibold text-muted-foreground">TOTAL</td>
 <td className="px-5 py-4 font-medium text-muted-foreground">
 {items.reduce((sum, i) => sum + i.hours, 0)}
 </td>
 <td className="px-5 py-4"></td>
 <td className="px-5 py-4 font-bold text-foreground">
 {formatPYG(total)}
 </td>
 <td></td>
 </tr>
 </tfoot>
 </table>

 {items.length === 0 && (
 <div className="flex flex-col items-center py-12 text-center">
 <Calculator className="mb-3 h-10 w-10 text-muted-foreground/50"/>
 <p className="text-muted-foreground">No hay items en el presupuesto</p>
 <p className="mt-1 text-xs text-muted-foreground/50">Agrega líneas para comenzar</p>
 </div>
 )}
 </div>

 {/* Add button */}
 <Button
 variant="outline"
 onClick={addItem}
 className="rounded-full"
 >
 <Plus className="mr-2 h-4 w-4"/> Agregar línea
 </Button>
 </div>
 );
}
