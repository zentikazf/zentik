# QA Fix Preview — 2026-03-31
> Generado por context-aware-coder. Revisar antes de aprobar la implementación.
> Fuente: IMPLEMENTATION_GUIDE.md — Épica 3: Kanban de Proyectos

---

## Resumen
- **Archivos modificados:** 4
- **Archivos nuevos:** 2 (migración + componente)
- **Repos afectados:** zentik-backend + zentik (frontend)

---

## BACKEND — zentik-backend

### 1. `prisma/schema.prisma` — Actualizar enum ProjectStatus

**Resumen:** Reemplazar los 5 valores actuales por 8 nuevos. DEFINITION→DISCOVERY, PRODUCTION→DEPLOY, se agregan PLANNING, TESTING, SUPPORT.

```diff
- enum ProjectStatus {
-   DEFINITION
-   DEVELOPMENT
-   PRODUCTION
-   ON_HOLD
-   COMPLETED
- }
+ enum ProjectStatus {
+   DISCOVERY
+   PLANNING
+   DEVELOPMENT
+   TESTING
+   DEPLOY
+   SUPPORT
+   ON_HOLD
+   COMPLETED
+ }
```

---

### 2. `prisma/migrations/20260331120000_update_project_statuses/migration.sql` — Migración nueva (ARCHIVO NUEVO)

**Resumen:** Migración que primero actualiza los datos existentes (DEFINITION→DISCOVERY, PRODUCTION→DEPLOY) y luego altera el tipo en PostgreSQL. El orden importa: datos primero, tipo después.

```sql
-- Actualizar datos existentes ANTES de cambiar el tipo
UPDATE "Project" SET status = 'DISCOVERY' WHERE status = 'DEFINITION';
UPDATE "Project" SET status = 'DEPLOY' WHERE status = 'PRODUCTION';

-- Renombrar enum viejo
ALTER TYPE "ProjectStatus" RENAME TO "ProjectStatus_old";

-- Crear enum nuevo con los 8 valores
CREATE TYPE "ProjectStatus" AS ENUM (
  'DISCOVERY', 'PLANNING', 'DEVELOPMENT', 'TESTING',
  'DEPLOY', 'SUPPORT', 'ON_HOLD', 'COMPLETED'
);

-- Migrar la columna al nuevo tipo
ALTER TABLE "Project"
  ALTER COLUMN "status" TYPE "ProjectStatus"
  USING "status"::text::"ProjectStatus";

-- Cambiar default
ALTER TABLE "Project"
  ALTER COLUMN "status" SET DEFAULT 'DISCOVERY'::"ProjectStatus";

-- Limpiar
DROP TYPE "ProjectStatus_old";
```

---

### 3. `src/modules/project/project.service.ts` — Cambiar default DEFINITION → DISCOVERY

**Resumen:** Solo cambia el string del default en `create()`. Una línea.

```diff
-         status: dto.status || 'DEFINITION',
+         status: dto.status || 'DISCOVERY',
```

---

## FRONTEND — zentik

### 4. `src/types/index.ts` — Actualizar enum ProjectStatus

**Resumen:** Reemplazar los 5 valores del enum por los 8 nuevos, manteniendo el mismo estilo de declaración existente.

```diff
  export enum ProjectStatus {
-   DEFINITION = 'DEFINITION',
-   DEVELOPMENT = 'DEVELOPMENT',
-   PRODUCTION = 'PRODUCTION',
-   ON_HOLD = 'ON_HOLD',
-   COMPLETED = 'COMPLETED',
+   DISCOVERY = 'DISCOVERY',
+   PLANNING = 'PLANNING',
+   DEVELOPMENT = 'DEVELOPMENT',
+   TESTING = 'TESTING',
+   DEPLOY = 'DEPLOY',
+   SUPPORT = 'SUPPORT',
+   ON_HOLD = 'ON_HOLD',
+   COMPLETED = 'COMPLETED',
  }
```

---

### 5. `src/components/project/project-kanban.tsx` — ARCHIVO NUEVO

**Resumen:** Componente kanban de proyectos. Usa los mismos patrones que `kanban/board.tsx`: `DndContext`, `PointerSensor`, `KeyboardSensor`, `closestCorners`, `DragOverlay`. Columnas fijas (no dinámicas). Drag → `api.patch(/projects/:id, { status })`. ON_HOLD y COMPLETED excluidos del kanban, mostrados como contadores laterales.

```tsx
'use client';

import { useState, useCallback } from 'react';
import {
  DndContext, DragOverlay, closestCorners,
  KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatRelative } from '@/lib/utils';
import Link from 'next/link';
import { Pause, CheckCircle2 } from 'lucide-react';

const PROJECT_COLUMNS = [
  { status: 'DISCOVERY',   name: 'Descubrimiento', color: '#8B5CF6' },
  { status: 'PLANNING',    name: 'Planificación',  color: '#3B82F6' },
  { status: 'DEVELOPMENT', name: 'Desarrollo',     color: '#F59E0B' },
  { status: 'TESTING',     name: 'Testing',        color: '#10B981' },
  { status: 'DEPLOY',      name: 'Deploy',         color: '#06B6D4' },
  { status: 'SUPPORT',     name: 'Soporte',        color: '#EF4444' },
];

// ProjectCard — draggable
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

// ProjectColumn — drop zone
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
  onProjectMoved?: (projectId: string, newStatus: string) => void;
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
    const p = localProjects.find((p) => p.id === event.active.id);
    if (p) setActiveProject(p);
  }, [localProjects]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveProject(null);
    if (!over || active.id === over.id) return;

    const projectId = active.id as string;
    // over.id can be a status string (column) or another project id
    const targetCol = PROJECT_COLUMNS.find((c) => c.status === over.id);
    const targetStatus = targetCol?.status
      ?? localProjects.find((p) => p.id === over.id)
        ? PROJECT_COLUMNS.find((c) =>
            c.status === localProjects.find((p) => p.id === over.id)?.status
          )?.status
        : null;

    if (!targetStatus) return;
    const project = localProjects.find((p) => p.id === projectId);
    if (!project || project.status === targetStatus) return;

    // Optimistic update
    setLocalProjects((prev) =>
      prev.map((p) => p.id === projectId ? { ...p, status: targetStatus } : p)
    );

    try {
      await api.patch(`/projects/${projectId}`, { status: targetStatus });
      onProjectMoved?.(projectId, targetStatus);
    } catch (err) {
      // Revert
      setLocalProjects((prev) =>
        prev.map((p) => p.id === projectId ? { ...p, status: project.status } : p)
      );
      const msg = err instanceof ApiError ? err.message : 'No se pudo mover el proyecto';
      toast.error('Error', msg);
    }
  }, [localProjects, onProjectMoved]);

  return (
    <div className="space-y-4">
      {/* Sidebar badges ON_HOLD / COMPLETED */}
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
```

---

### 6. `src/app/(dashboard)/projects/page.tsx` — Toggle lista/kanban + actualizar statusColors/Labels

**Resumen:** 3 cambios:
1. Agregar import de `LayoutGrid`, `LayoutList` y del nuevo componente
2. Agregar estado `view` con toggle en el header
3. Actualizar `statusColors` y `statusLabels` con los nuevos 8 valores
4. Renderizar `<ProjectKanban>` cuando `view === 'kanban'`

```diff
- import { Plus, Search, FolderKanban } from 'lucide-react';
+ import { Plus, Search, FolderKanban, LayoutGrid, LayoutList } from 'lucide-react';
+ import { ProjectKanban } from '@/components/project/project-kanban';

  // dentro del componente, después de los otros estados:
+ const [view, setView] = useState<'list' | 'kanban'>('list');

  // statusColors actualizado:
  const statusColors: Record<string, string> = {
-   DEFINITION: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
-   DEVELOPMENT: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
-   PRODUCTION: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
-   ON_HOLD: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
-   COMPLETED: 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
+   DISCOVERY:   'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
+   PLANNING:    'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
+   DEVELOPMENT: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400',
+   TESTING:     'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
+   DEPLOY:      'bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400',
+   SUPPORT:     'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
+   ON_HOLD:     'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
+   COMPLETED:   'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };

  // statusLabels actualizado:
  const statusLabels: Record<string, string> = {
-   DEFINITION: 'Definición',
-   DEVELOPMENT: 'Desarrollo',
-   PRODUCTION: 'Producción',
-   ON_HOLD: 'En Pausa',
-   COMPLETED: 'Completado',
+   DISCOVERY:   'Descubrimiento',
+   PLANNING:    'Planificación',
+   DEVELOPMENT: 'Desarrollo',
+   TESTING:     'Testing',
+   DEPLOY:      'Deploy',
+   SUPPORT:     'Soporte',
+   ON_HOLD:     'En Pausa',
+   COMPLETED:   'Completado',
  };

  // En el header, después del botón "Nuevo Proyecto":
+ <div className="flex items-center gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-800">
+   <button
+     onClick={() => setView('list')}
+     className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors
+       ${view === 'list' ? 'bg-white shadow dark:bg-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
+   >
+     <LayoutList className="h-3.5 w-3.5" />
+   </button>
+   <button
+     onClick={() => setView('kanban')}
+     className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors
+       ${view === 'kanban' ? 'bg-white shadow dark:bg-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
+   >
+     <LayoutGrid className="h-3.5 w-3.5" />
+   </button>
+ </div>

  // Reemplazar la sección de renderizado (después del search):
- {filtered.length === 0 ? ( ... ) : (
-   <div className="grid ...">
-     {filtered.map(...)}
-   </div>
- )}
+ {view === 'kanban' ? (
+   <ProjectKanban projects={filtered} onProjectMoved={loadProjects} />
+ ) : filtered.length === 0 ? (
+   <div className="flex flex-col items-center ..."> ... </div>
+ ) : (
+   <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
+     {filtered.map(...)} {/* sin cambios */}
+   </div>
+ )}
```
