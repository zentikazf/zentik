'use client';

import { useState, useCallback, useEffect } from 'react';
import {
 DndContext,
 DragOverlay,
 closestCorners,
 KeyboardSensor,
 PointerSensor,
 useSensor,
 useSensors,
 type DragStartEvent,
 type DragEndEvent,
} from '@dnd-kit/core';
import {
 SortableContext,
 horizontalListSortingStrategy,
 arrayMove,
} from '@dnd-kit/sortable';
import { KanbanColumn } from './column';
import { KanbanCard } from './card';
import type { BoardColumn, Task } from '@/types';
import { useBoardStore } from '@/stores/use-board-store';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { TaskHoursGateDialog } from '@/components/task/task-hours-gate-dialog';

interface KanbanBoardProps {
 boardId: string;
 columns: BoardColumn[];
 currentUserId?: string;
 currentUserRoleId?: string;
 showOnlyMyTasks?: boolean;
 onEditColumn?: (column: any) => void;
 onDeleteColumn?: (columnId: string) => void;
 onAddTask?: (columnId: string) => void;
 onTaskClick?: (taskId: string) => void;
}

export function KanbanBoard({
 boardId,
 columns: initialColumns,
 currentUserId,
 currentUserRoleId,
 showOnlyMyTasks,
 onEditColumn,
 onDeleteColumn,
 onAddTask,
 onTaskClick,
}: KanbanBoardProps) {
 const { columns, setColumns, moveTask } = useBoardStore();
 const [activeTask, setActiveTask] = useState<Task | null>(null);

 // H6 — gate de horas reactivo: el backend rechaza el move sin horas → abrimos el diálogo.
 const [gateOpen, setGateOpen] = useState(false);
 const [gateInfo, setGateInfo] = useState<{
 taskId: string;
 targetStatus: string;
 targetColumnId: string;
 sourceColumnId: string;
 canCloseWithoutHours: boolean;
 logHoursEndpoint?: string;
 } | null>(null);

 useEffect(() => {
 setColumns(initialColumns);
 }, [initialColumns, setColumns]);

 const sensors = useSensors(
 useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
 useSensor(KeyboardSensor),
 );

 const handleDragStart = useCallback((event: DragStartEvent) => {
 const { active } = event;
 const task = columns
 .flatMap((col) => col.tasks || [])
 .find((t) => t.id === active.id);
 if (task) setActiveTask(task);
 }, [columns]);

 const handleDragEnd = useCallback(
 async (event: DragEndEvent) => {
 const { active, over } = event;
 setActiveTask(null);

 if (!over || active.id === over.id) return;

 const activeId = active.id as string;
 const overId = over.id as string;

 // Check if we're reordering columns (active is a column id)
 const activeColIdx = columns.findIndex((c) => c.id === activeId);
 const overColIdx = columns.findIndex((c) => c.id === overId);

 if (activeColIdx !== -1 && overColIdx !== -1) {
 // Column reorder
 const newColumns = arrayMove(columns, activeColIdx, overColIdx);
 setColumns(newColumns);
 api.patch(`/boards/${boardId}/columns/reorder`, {
 columnIds: newColumns.map((c) => c.id),
 }).catch(() => {});
 return;
 }

 // Task move — determine target column
 const sourceColumn = columns.find((col) =>
 col.tasks?.some((t) => t.id === activeId),
 );
 if (!sourceColumn) return;

 // overId could be a column ID or a task ID (if dropped on a task)
 let targetColumnId = overId;
 const isColumn = columns.some((c) => c.id === overId);
 if (!isColumn) {
 // Dropped on a task — find which column contains that task
 const targetCol = columns.find((col) =>
 col.tasks?.some((t) => t.id === overId),
 );
 if (targetCol) {
 targetColumnId = targetCol.id;
 } else {
 return;
 }
 }

 if (sourceColumn.id === targetColumnId) return;

 moveTask(activeId, sourceColumn.id, targetColumnId, 0);

 try {
 await api.patch(`/boards/${boardId}/tasks/move`, {
 taskId: activeId,
 targetColumnId,
 position: 0,
 });
 } catch (err) {
 // Revert optimista
 moveTask(activeId, targetColumnId, sourceColumn.id, 0);
 // H6: si se bloqueó por falta de horas, abrir el diálogo del gate (no el toast plano).
 // La card no carga timeEntries → el gate es forzosamente reactivo.
 if (err instanceof ApiError && err.code === 'WORK_HOURS_REQUIRED') {
 const d = (err.details || {}) as Record<string, unknown>;
 setGateInfo({
 taskId: (d.taskId as string) || activeId,
 targetStatus: (d.targetStatus as string) || '',
 targetColumnId,
 sourceColumnId: sourceColumn.id,
 canCloseWithoutHours: !!d.canCloseWithoutHours,
 logHoursEndpoint: d.logHoursEndpoint as string | undefined,
 });
 setGateOpen(true);
 return;
 }
 const msg = err instanceof ApiError ? err.message : 'No se pudo mover la tarea';
 toast.error('Movimiento bloqueado', msg);
 }
 },
 [columns, boardId, moveTask, setColumns],
 );

 return (
 <>
 <DndContext
 sensors={sensors}
 collisionDetection={closestCorners}
 onDragStart={handleDragStart}
 onDragEnd={handleDragEnd}
 >
 <div className="flex gap-4 overflow-x-auto pb-4">
 <SortableContext
 items={columns.map((c) => c.id)}
 strategy={horizontalListSortingStrategy}
 >
 {columns.map((column) => {
 const filteredColumn = showOnlyMyTasks && currentUserId
 ? { ...column, tasks: (column.tasks || []).filter((t) => (t as any).assignments?.some((a: any) => a.user.id === currentUserId) || t.assignees?.some((a: any) => a.id === currentUserId)) }
 : column;
 return (
 <KanbanColumn
 key={column.id}
 column={filteredColumn}
 currentUserId={currentUserId}
 currentUserRoleId={currentUserRoleId}
 onAddTask={onAddTask ? () => onAddTask(column.id) : undefined}
 onEditColumn={onEditColumn ? () => onEditColumn(column) : undefined}
 onDeleteColumn={onDeleteColumn ? () => onDeleteColumn(column.id) : undefined}
 onTaskClick={onTaskClick}
 />
 );
 })}
 </SortableContext>
 </div>

 <DragOverlay>
 {activeTask ? <KanbanCard task={activeTask} overlay /> : null}
 </DragOverlay>
 </DndContext>

 {gateInfo && (
 <TaskHoursGateDialog
 open={gateOpen}
 onOpenChange={setGateOpen}
 taskId={gateInfo.taskId}
 targetLabel={gateInfo.targetStatus === 'DONE' ? 'Completada' : 'En Revisión'}
 canCloseWithoutHours={gateInfo.canCloseWithoutHours}
 logHoursEndpoint={gateInfo.logHoursEndpoint}
 onLogged={async () => {
 // Horas ya registradas en el diálogo → reintentar el move.
 await api.patch(`/boards/${boardId}/tasks/move`, {
 taskId: gateInfo.taskId,
 targetColumnId: gateInfo.targetColumnId,
 position: 0,
 });
 moveTask(gateInfo.taskId, gateInfo.sourceColumnId, gateInfo.targetColumnId, 0);
 }}
 onEscape={async (reason) => {
 // El board no cierra sin horas por el move (gate duro); se reenvía por PATCH /tasks/:id.
 await api.patch(`/tasks/${gateInfo.taskId}`, {
 status: gateInfo.targetStatus,
 closeWithoutHours: true,
 closeWithoutHoursReason: reason,
 });
 moveTask(gateInfo.taskId, gateInfo.sourceColumnId, gateInfo.targetColumnId, 0);
 }}
 />
 )}
 </>
 );
}
