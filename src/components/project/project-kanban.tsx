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
 useDroppable,
 type DragStartEvent,
 type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatRelative } from '@/lib/utils';
import { Pause, CheckCircle2, Lock, Archive } from 'lucide-react';
import { useRouter } from 'next/navigation';

const PROJECT_COLUMNS = [
 { status: 'DISCOVERY', name: 'Descubrimiento', color: '#8B5CF6' },
 { status: 'PLANNING', name: 'Planificación', color: '#3B82F6' },
 { status: 'DEVELOPMENT', name: 'Desarrollo', color: '#F59E0B' },
 { status: 'TESTING', name: 'Testing', color: '#10B981' },
 { status: 'DEPLOY', name: 'Deploy', color: '#06B6D4' },
 { status: 'SUPPORT', name: 'Soporte', color: '#EF4444' },
];

function ProjectCard({ project, overlay, onClick }: { project: any; overlay?: boolean; onClick?: () => void }) {
 const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
 useSortable({ id: project.id });

 const isFrozen = (project.client && project.client.status !== 'ACTIVE') || (project.lifecycleStatus && project.lifecycleStatus !== 'ACTIVE');

 const style = {
 transform: CSS.Transform.toString(transform),
 transition,
 opacity: isDragging ? 0.4 : isFrozen ? 0.5 : 1,
 };

 return (
 <div
 ref={setNodeRef}
 style={style}
 {...attributes}
 {...listeners}
 onClick={() => { if (!isDragging && !isFrozen && onClick) onClick(); }}
 className={`rounded-xl bg-card p-4 transition-all
 border border-transparent hover:border-border
 ${isFrozen ? 'cursor-not-allowed grayscale' : 'cursor-grab active:cursor-grabbing'}
 ${overlay ? 'shadow-xl rotate-1' : 'shadow-sm'}`}
 >
 {project.lifecycleStatus === 'DISABLED' && (
 <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
 <Lock className="h-2.5 w-2.5" /> Deshabilitado
 </span>
 )}
 {project.lifecycleStatus === 'ARCHIVED' && (
 <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
 <Archive className="h-2.5 w-2.5" /> Archivado
 </span>
 )}
 {isFrozen && project.lifecycleStatus === 'ACTIVE' && (
 <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
 <Lock className="h-2.5 w-2.5" /> Congelado
 </span>
 )}
 <p className="text-[13px] font-semibold text-foreground line-clamp-2">{project.name}</p>
 {project.client?.name && (
 <p className={`mt-0.5 text-[11px] ${isFrozen ? 'text-muted-foreground' : 'text-primary'}`}>{project.client.name}</p>
 )}
 <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
 <span>{project._count?.tasks || 0} tareas</span>
 <span>{formatRelative(project.updatedAt)}</span>
 </div>
 </div>
 );
}

function ProjectColumn({ col, projects, onCardClick }: { col: typeof PROJECT_COLUMNS[0]; projects: any[]; onCardClick: (id: string) => void }) {
 const { setNodeRef, isOver } = useDroppable({ id: col.status });

 return (
 <div className="flex w-64 flex-shrink-0 flex-col gap-2">
 <div className="flex items-center gap-2 px-1">
 <div className="h-2.5 w-2.5 rounded-full"style={{ background: col.color }} />
 <span className="text-[13px] font-semibold text-foreground">{col.name}</span>
 <Badge className="ml-auto bg-muted text-muted-foreground text-[10px]">
 {projects.length}
 </Badge>
 </div>
 <SortableContext items={projects.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
 <div
 ref={setNodeRef}
 className={`min-h-[120px] space-y-2 rounded-xl p-2 transition-colors ${
 isOver ? 'bg-muted/80 ring-2 ring-primary/30' : 'bg-muted'
 }`}
 >
 {projects.map((p) => (
 <ProjectCard key={p.id} project={p} onClick={() => onCardClick(p.id)} />
 ))}
 {projects.length === 0 && (
 <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
 Arrastra proyectos aquí
 </div>
 )}
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
 const router = useRouter();
 const [localProjects, setLocalProjects] = useState(projects);
 const [activeProject, setActiveProject] = useState<any>(null);

 useEffect(() => {
 setLocalProjects(projects);
 }, [projects]);

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

 // overId puede ser un status de columna (useDroppable) o un ID de proyecto (useSortable)
 const isColumn = PROJECT_COLUMNS.some((c) => c.status === overId);
 const targetStatus = isColumn
 ? overId
 : localProjects.find((p) => p.id === overId)?.status;

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

 const handleCardClick = useCallback((projectId: string) => {
 router.push(`/projects/${projectId}`);
 }, [router]);

 return (
 <div className="space-y-4">
 {(onHold.length > 0 || completed.length > 0) && (
 <div className="flex gap-3">
 {onHold.length > 0 && (
 <div className="flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-xs text-warning">
 <Pause className="h-3 w-3"/>
 {onHold.length} en pausa
 </div>
 )}
 {completed.length > 0 && (
 <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
 <CheckCircle2 className="h-3 w-3"/>
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
 onCardClick={handleCardClick}
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
