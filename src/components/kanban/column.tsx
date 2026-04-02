'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './card';
import { Button } from '@/components/ui/button';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { BoardColumn } from '@/types';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
 column: BoardColumn;
 onAddTask?: () => void;
 onEditColumn?: () => void;
 onDeleteColumn?: () => void;
 onTaskClick?: (taskId: string) => void;
}

export function KanbanColumn({ column, onAddTask, onEditColumn, onDeleteColumn, onTaskClick }: KanbanColumnProps) {
 const { setNodeRef, isOver } = useDroppable({ id: column.id });

 const hasMenu = onEditColumn || onDeleteColumn;
 const tasks = column.tasks || [];
 const columnColor = column.color || '#6366f1';

 return (
 <div className="flex w-72 flex-shrink-0 flex-col min-w-0">
 {/* Column Header */}
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <div className="h-2 w-2 rounded-full"style={{ backgroundColor: columnColor }} />
 <h3 className="font-medium text-[#0d062d] text-[15px]">
 {column.name}
 </h3>
 <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
 <span className="text-[11px] font-medium text-muted-foreground">
 {tasks.length}
 </span>
 </div>
 </div>
 <div className="flex items-center gap-0.5">
 {onAddTask && (
 <Button variant="ghost"size="icon"className="h-6 w-6 text-muted-foreground hover:text-primary"onClick={onAddTask}>
 <Plus className="h-4 w-4"/>
 </Button>
 )}
 {hasMenu && (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost"size="icon"className="h-6 w-6 text-muted-foreground hover:text-foreground">
 <MoreVertical className="h-3.5 w-3.5"/>
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 {onEditColumn && (
 <DropdownMenuItem onClick={onEditColumn}>
 <Pencil className="mr-2 h-4 w-4"/>
 Editar columna
 </DropdownMenuItem>
 )}
 {onDeleteColumn && (
 <DropdownMenuItem onClick={onDeleteColumn} className="text-destructive focus:text-destructive">
 <Trash2 className="mr-2 h-4 w-4"/>
 Eliminar columna
 </DropdownMenuItem>
 )}
 </DropdownMenuContent>
 </DropdownMenu>
 )}
 </div>
 </div>

 {/* Column Separator Line */}
 <div className="h-0.5 w-full mb-4 rounded-full"style={{ backgroundColor: columnColor }} />

 {/* Cards Container */}
 <div
 ref={setNodeRef}
 className={cn(
 'flex-1 rounded-t-2xl bg-muted p-3 space-y-3 overflow-y-auto transition-colors',
 isOver && 'bg-muted/80 ring-2 ring-inset',
 )}
 style={isOver ? { '--tw-ring-color': columnColor } as React.CSSProperties : undefined}
 >
 <SortableContext
 items={tasks.map((t) => t.id)}
 strategy={verticalListSortingStrategy}
 >
 {tasks.map((task) => (
 <KanbanCard
 key={task.id}
 task={task}
 onClick={onTaskClick ? () => onTaskClick(task.id) : undefined}
 />
 ))}
 </SortableContext>

 {tasks.length === 0 && (
 <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
 Arrastra tareas aquí
 </div>
 )}
 </div>
 </div>
 );
}
