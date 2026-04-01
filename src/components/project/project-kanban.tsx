'use client';

import { useState, useCallback } from 'react';
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
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatRelative } from '@/lib/utils';
import { Pause, CheckCircle2 } from 'lucide-react';

const PROJECT_COLUMNS = [
  { status: 'DISCOVERY',   name: 'Descubrimiento', color: '#8B5CF6' },
  { status: 'PLANNING',    name: 'Planificación',  color: '#3B82F6' },
  { status: 'DEVELOPMENT', name: 'Desarrollo',     color: '#F59E0B' },
  { status: 'TESTING',     name: 'Testing',        color: '#10B981' },
  { status: 'DEPLOY',      name: 'Deploy',         color: '#06B6D4' },
  { status: 'SUPPORT',     name: 'Soporte',        color: '#EF4444' },
];

function ProjectCard({ project, overlay }: { project: any; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-[20px] bg-white p-4 dark:bg-gray-800 cursor-grab active:cursor-grabbing
        border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all
        ${overlay ? 'shadow-xl rotate-1' : 'shadow-sm'}`}
    >
      <p className="text-[13px] font-semibold text-gray-800 dark:text-white line-clamp-2">{project.name}</p>
      {project.client?.name && (
        <p className="mt-0.5 text-[11px] text-blue-500">{project.client.name}</p>
      )}
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
        <span>{project._count?.tasks || 0} tareas</span>
        <span>{formatRelative(project.updatedAt)}</span>
      </div>
    </div>
  );
}

function ProjectColumn({ col, projects }: { col: typeof PROJECT_COLUMNS[0]; projects: any[] }) {
  return (
    <div className="flex w-64 flex-shrink-0 flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <div className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
        <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">{col.name}</span>
        <Badge className="ml-auto bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 text-[10px]">
          {projects.length}
        </Badge>
      </div>
      <SortableContext items={projects.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
        <div
          id={col.status}
          className="min-h-[120px] space-y-2 rounded-[16px] bg-gray-50 p-2 dark:bg-gray-900/50"
        >
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      </SortableContext>
    </div>
  );
}

interface ProjectKanbanProps {
  projects: any[];
  onProjectMoved?: () => void;
}

export function ProjectKanban({ projects, onProjectMoved }: ProjectKanbanProps) {
  const [localProjects, setLocalProjects] = useState(projects);
  const [activeProject, setActiveProject] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const kanbanProjects = localProjects.filter(
    (p) => p.status !== 'ON_HOLD' && p.status !== 'COMPLETED',
  );
  const onHold = localProjects.filter((p) => p.status === 'ON_HOLD');
  const completed = localProjects.filter((p) => p.status === 'COMPLETED');

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const p = localProjects.find((proj) => proj.id === event.active.id);
    if (p) setActiveProject(p);
  }, [localProjects]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveProject(null);
    if (!over || active.id === over.id) return;

    const projectId = active.id as string;
    const overId = over.id as string;

    // Determine target status: over can be a column status or another project id
    const targetCol = PROJECT_COLUMNS.find((c) => c.status === overId);
    const targetStatus = targetCol?.status
      ?? PROJECT_COLUMNS.find((c) =>
          c.status === localProjects.find((p) => p.id === overId)?.status
        )?.status;

    if (!targetStatus) return;
    const project = localProjects.find((p) => p.id === projectId);
    if (!project || project.status === targetStatus) return;

    // Optimistic update
    setLocalProjects((prev) =>
      prev.map((p) => p.id === projectId ? { ...p, status: targetStatus } : p),
    );

    try {
      await api.patch(`/projects/${projectId}`, { status: targetStatus });
      onProjectMoved?.();
    } catch (err) {
      // Revert
      setLocalProjects((prev) =>
        prev.map((p) => p.id === projectId ? { ...p, status: project.status } : p),
      );
      const msg = err instanceof ApiError ? err.message : 'No se pudo mover el proyecto';
      toast.error('Error', msg);
    }
  }, [localProjects, onProjectMoved]);

  return (
    <div className="space-y-4">
      {(onHold.length > 0 || completed.length > 0) && (
        <div className="flex gap-3">
          {onHold.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs text-orange-600 dark:bg-orange-950 dark:text-orange-400">
              <Pause className="h-3 w-3" />
              {onHold.length} en pausa
            </div>
          )}
          {completed.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <CheckCircle2 className="h-3 w-3" />
              {completed.length} completados
            </div>
          )}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PROJECT_COLUMNS.map((col) => (
            <ProjectColumn
              key={col.status}
              col={col}
              projects={kanbanProjects.filter((p) => p.status === col.status)}
            />
          ))}
        </div>
        <DragOverlay>
          {activeProject ? <ProjectCard project={activeProject} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
