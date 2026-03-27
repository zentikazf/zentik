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
import { Plus } from 'lucide-react';
import type { BoardColumn, Task } from '@/types';
import { useBoardStore } from '@/stores/use-board-store';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

interface KanbanBoardProps {
  boardId: string;
  columns: BoardColumn[];
  onAddColumn?: () => void;
  onEditColumn?: (column: any) => void;
  onDeleteColumn?: (columnId: string) => void;
  onAddTask?: (columnId: string) => void;
  onTaskClick?: (taskId: string) => void;
}

export function KanbanBoard({
  boardId,
  columns: initialColumns,
  onAddColumn,
  onEditColumn,
  onDeleteColumn,
  onAddTask,
  onTaskClick,
}: KanbanBoardProps) {
  const { columns, setColumns, moveTask } = useBoardStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

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
        // Revert on failure
        moveTask(activeId, targetColumnId, sourceColumn.id, 0);
        const msg = err instanceof ApiError ? err.message : 'No se pudo mover la tarea';
        toast.error('Movimiento bloqueado', msg);
      }
    },
    [columns, boardId, moveTask, setColumns],
  );

  return (
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
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              onAddTask={onAddTask ? () => onAddTask(column.id) : undefined}
              onEditColumn={onEditColumn ? () => onEditColumn(column) : undefined}
              onDeleteColumn={onDeleteColumn ? () => onDeleteColumn(column.id) : undefined}
              onTaskClick={onTaskClick}
            />
          ))}
        </SortableContext>

        {/* Add column placeholder */}
        {onAddColumn && (
          <button
            onClick={onAddColumn}
            className="flex h-[calc(100vh-12rem)] w-72 flex-shrink-0 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-primary"
          >
            <Plus className="h-8 w-8" />
            <span className="text-sm font-medium">Agregar Columna</span>
          </button>
        )}
      </div>

      <DragOverlay>
        {activeTask ? <KanbanCard task={activeTask} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
