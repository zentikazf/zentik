'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play, Square, Clock, Check, Edit3 } from 'lucide-react';
import { useTimer } from '@/hooks/use-timer';
import { cn, formatDuration } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

interface TimerWidgetProps {
 taskId?: string;
 taskTitle?: string;
 className?: string;
}

export function TimerWidget({ taskId, taskTitle, className }: TimerWidgetProps) {
 const { isRunning, activeTimer, start, stop } = useTimer();
 const elapsed = activeTimer?.elapsed ?? 0;

 // Confirmation state after stopping
 const [confirming, setConfirming] = useState(false);
 const [stoppedDuration, setStoppedDuration] = useState(0);
 const [adjustedHours, setAdjustedHours] = useState('');
 const [adjustedMinutes, setAdjustedMinutes] = useState('');
 const [editing, setEditing] = useState(false);
 const [saving, setSaving] = useState(false);

 const handleStart = async () => {
 if (taskId) await start(taskId);
 };

 const handleStop = async () => {
 const result = await stop();
 if (result) {
 // Show confirmation with tracked duration
 const duration = activeTimer?.elapsed ?? 0;
 setStoppedDuration(duration);
 setAdjustedHours(String(Math.floor(duration / 3600)));
 setAdjustedMinutes(String(Math.floor((duration % 3600) / 60)));
 setConfirming(true);
 setEditing(false);
 }
 };

 const handleConfirm = async (billable: boolean) => {
 setSaving(true);
 try {
 if (editing) {
 // User adjusted hours — update the last time entry
 const totalSeconds = (Number(adjustedHours) || 0) * 3600 + (Number(adjustedMinutes) || 0) * 60;
 // The stop already created the time entry, we need to update it
 // Fetch the latest entry and update
 const entries = await api.get<any>('/time-entries?limit=1');
 const latest = entries.data?.data?.[0] || entries.data?.[0];
 if (latest) {
 await api.patch(`/time-entries/${latest.id}`, {
 duration: totalSeconds,
 billable,
 });
 }
 } else {
 // Confirm as-is, just mark billable status
 const entries = await api.get<any>('/time-entries?limit=1');
 const latest = entries.data?.data?.[0] || entries.data?.[0];
 if (latest) {
 await api.patch(`/time-entries/${latest.id}`, { billable });
 }
 }
 toast.success(
 billable ? 'Horas facturadas' : 'Horas registradas',
 `${adjustedHours}h ${adjustedMinutes}m ${billable ? 'marcadas como facturables' : 'guardadas'}`,
 );
 } catch {
 toast.error('Error', 'No se pudo actualizar el registro de tiempo');
 } finally {
 setSaving(false);
 setConfirming(false);
 }
 };

 // Confirmation view after stopping the timer
 if (confirming) {
 const h = Number(adjustedHours) || 0;
 const m = Number(adjustedMinutes) || 0;

 return (
 <Card className={cn('p-4 space-y-3 border-primary/30 bg-primary/10', className)}>
 <div className="flex items-center gap-2">
 <Clock className="h-4 w-4 text-primary"/>
 <span className="text-sm font-semibold text-foreground">
 ¿Estas horas están bien?
 </span>
 </div>

 {editing ? (
 <div className="flex items-center gap-2">
 <div className="flex items-center gap-1">
 <Input
 type="number"
 value={adjustedHours}
 onChange={(e) => setAdjustedHours(e.target.value)}
 className="h-8 w-16 text-center text-sm font-mono"
 min={0}
 />
 <Label className="text-xs text-muted-foreground">h</Label>
 </div>
 <div className="flex items-center gap-1">
 <Input
 type="number"
 value={adjustedMinutes}
 onChange={(e) => setAdjustedMinutes(e.target.value)}
 className="h-8 w-16 text-center text-sm font-mono"
 min={0}
 max={59}
 />
 <Label className="text-xs text-muted-foreground">m</Label>
 </div>
 </div>
 ) : (
 <div className="flex items-center justify-between">
 <span className="font-mono text-lg font-bold text-primary">
 {h}h {m}m
 </span>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => setEditing(true)}
 className="h-7 text-xs text-muted-foreground hover:text-primary"
 >
 <Edit3 className="h-3 w-3 mr-1"/> Ajustar
 </Button>
 </div>
 )}

 <div className="flex gap-2">
 <Button
 size="sm"
 onClick={() => handleConfirm(true)}
 disabled={saving}
 className="flex-1 h-8 text-xs bg-primary hover:bg-primary/90"
 >
 <Check className="h-3 w-3 mr-1"/>
 {saving ? 'Guardando...' : 'Facturar'}
 </Button>
 <Button
 variant="outline"
 size="sm"
 onClick={() => handleConfirm(false)}
 disabled={saving}
 className="flex-1 h-8 text-xs"
 >
 Solo registrar
 </Button>
 </div>

 <button
 onClick={() => setConfirming(false)}
 className="w-full text-center text-[11px] text-muted-foreground hover:text-muted-foreground transition-colors"
 >
 Descartar
 </button>
 </Card>
 );
 }

 return (
 <Card className={cn('flex items-center gap-3 p-3', className)}>
 <Button
 variant={isRunning ? 'destructive' : 'default'}
 size="icon"
 className="h-8 w-8 shrink-0"
 onClick={isRunning ? handleStop : handleStart}
 disabled={!taskId && !isRunning}
 >
 {isRunning ? (
 <Square className="h-3.5 w-3.5"/>
 ) : (
 <Play className="h-3.5 w-3.5"/>
 )}
 </Button>

 <div className="min-w-0 flex-1">
 {taskTitle ? (
 <p className="truncate text-sm font-medium">{taskTitle}</p>
 ) : (
 <p className="text-sm text-muted-foreground">Sin tarea seleccionada</p>
 )}
 </div>

 <div className="flex items-center gap-1.5">
 <Clock className="h-3.5 w-3.5 text-muted-foreground"/>
 <span
 className={cn(
 'font-mono text-sm tabular-nums',
 isRunning && 'text-primary font-semibold',
 )}
 >
 {formatDuration(elapsed)}
 </span>
 </div>

 {isRunning && (
 <Badge variant="secondary"className="animate-pulse text-xs">
 Grabando
 </Badge>
 )}
 </Card>
 );
}
