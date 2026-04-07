'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Plus, Search, LayoutDashboard, List, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CreateTaskDialog } from '@/components/task/create-task-dialog';
import { useBoardStore } from '@/stores/use-board-store';
import { useAuth } from '@/hooks/use-auth';
import { useOrg } from '@/providers/org-provider';

const KanbanBoard = dynamic(() => import('@/components/kanban/board').then(m => m.KanbanBoard), { ssr: false, loading: () => <Skeleton className="h-[600px] w-full"/> });
const ColumnDialog = dynamic(() => import('@/components/board/column-dialog').then(m => m.ColumnDialog), { ssr: false });
const TaskSheet = dynamic(() => import('@/components/task/task-sheet').then(m => m.TaskSheet), { ssr: false });

const STATUS_COLORS: Record<string, string> = {
 BACKLOG: 'bg-muted-foreground', TODO: 'bg-primary', IN_PROGRESS: 'bg-warning',
 IN_REVIEW: 'bg-info', DONE: 'bg-success', CANCELLED: 'bg-destructive',
};

const STATUS_LABELS: Record<string, string> = {
 BACKLOG: 'Backlog', TODO: 'Por hacer', IN_PROGRESS: 'En progreso',
 IN_REVIEW: 'En revisión', DONE: 'Completada', CANCELLED: 'Cancelada',
};

const PRIORITY_COLORS: Record<string, string> = {
 URGENT: 'text-destructive bg-destructive/10 border-destructive/20',
 HIGH: 'text-warning bg-warning/10 border-warning/30',
 MEDIUM: 'text-warning bg-warning/10 border-warning/20',
 LOW: 'text-success bg-success/10 border-success/20',
};

const PRIORITY_LABELS: Record<string, string> = {
 URGENT: 'Urgente', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja',
};

export default function TareasPage() {
 const params = useParams();
 const router = useRouter();
 const projectId = params.projectId as string;
 const { user } = useAuth();
 const { organization } = useOrg();
 const { addTaskToColumn } = useBoardStore();

 // View mode: kanban (default) or list
 const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

 // List view state
 const [tasks, setTasks] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [createOpen, setCreateOpen] = useState(false);
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState<string>('ALL');
 const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

 // Kanban view state
 const [boards, setBoards] = useState<any[]>([]);
 const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
 const [board, setBoard] = useState<any>(null);
 const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(false);
 const [columnDialogOpen, setColumnDialogOpen] = useState(false);
 const [editingColumn, setEditingColumn] = useState<any>(null);
 const [createTaskColumnId, setCreateTaskColumnId] = useState<string | undefined>();
 const [sheetTaskId, setSheetTaskId] = useState<string | null>(null);
 const [sheetOpen, setSheetOpen] = useState(false);

 // Load tasks for list view
 const loadTasks = useCallback(async () => {
  try {
   const qp: Record<string, string> = { sort: '-priority', limit: '100' };
   if (statusFilter !== 'ALL') qp.status = statusFilter;
   if (priorityFilter !== 'ALL') qp.priority = priorityFilter;

   const query = new URLSearchParams(qp).toString();
   const res = await api.get(`/projects/${projectId}/tasks?${query}`);
   const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
   setTasks(list);
  } catch (err) {
   const msg = err instanceof ApiError ? err.message : 'Error al cargar tareas';
   toast.error('Error', msg);
  }
 }, [projectId, statusFilter, priorityFilter]);

 // Load boards for kanban view
 const loadBoards = useCallback(async () => {
  try {
   const res = await api.get(`/projects/${projectId}/boards`);
   const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
   setBoards(list);
   return list;
  } catch (err) {
   const message = err instanceof ApiError ? err.message : 'Error al cargar tableros';
   toast.error('Error', message);
   return [];
  }
 }, [projectId]);

 const loadBoard = useCallback(async (boardId: string) => {
  try {
   const res = await api.get(`/projects/${projectId}/boards/${boardId}`);
   setBoard(res.data);
  } catch (err) {
   const message = err instanceof ApiError ? err.message : 'Error al cargar el tablero';
   toast.error('Error', message);
  }
 }, [projectId]);

 // Initial load
 useEffect(() => {
  const init = async () => {
   setLoading(true);
   const [boardList] = await Promise.all([loadBoards(), loadTasks()]);
   if (boardList.length > 0) {
    setSelectedBoardId(boardList[0].id);
    await loadBoard(boardList[0].id);
   }
   setLoading(false);
  };
  init();
 }, [projectId, loadBoards, loadTasks, loadBoard]);

 // Reload board when selection changes
 useEffect(() => {
  if (selectedBoardId) loadBoard(selectedBoardId);
 }, [selectedBoardId, loadBoard]);

 // Reload list when filters change
 useEffect(() => {
  if (!loading) loadTasks();
 }, [statusFilter, priorityFilter]);

 const filteredTasks = tasks.filter((t) =>
  t.title.toLowerCase().includes(search.toLowerCase()),
 );

 // Kanban handlers
 const handleColumnSaved = () => {
  if (selectedBoardId) loadBoard(selectedBoardId);
  setEditingColumn(null);
 };
 const handleAddColumn = () => { setEditingColumn(null); setColumnDialogOpen(true); };
 const handleEditColumn = (column: any) => { setEditingColumn(column); setColumnDialogOpen(true); };
 const handleDeleteColumn = async (columnId: string) => {
  if (!board) return;
  try {
   await api.delete(`/boards/${board.id}/columns/${columnId}`);
   toast.success('Columna eliminada');
   await loadBoard(board.id);
  } catch (err) {
   const message = err instanceof ApiError ? err.message : 'Error al eliminar la columna';
   toast.error('Error', message);
  }
 };
 const handleAddTask = (columnId: string) => { setCreateTaskColumnId(columnId); setCreateTaskOpen(true); };
 const handleTaskClick = (taskId: string) => { setSheetTaskId(taskId); setSheetOpen(true); };
 const handleTaskUpdated = () => { if (selectedBoardId) loadBoard(selectedBoardId); loadTasks(); };

 const handleTaskCreated = (task: any) => {
  setTasks((prev) => [task, ...prev]);
  if (createTaskColumnId) addTaskToColumn(createTaskColumnId, task);
 };

 const setCreateTaskOpen = (open: boolean) => {
  setCreateOpen(open);
  if (!open) setCreateTaskColumnId(undefined);
 };

 if (loading) {
  return <Skeleton className="h-[calc(100vh-8rem)] w-full rounded-xl"/>;
 }

 return (
  <div className="flex flex-col gap-4">
   {/* Header */}
   <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
     <h1 className="text-lg font-semibold text-foreground">Tareas</h1>
     {/* View Toggle */}
     <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
      <button
       onClick={() => setViewMode('kanban')}
       className={cn(
        'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all',
        viewMode === 'kanban'
         ? 'bg-background shadow-sm text-foreground border border-border'
         : 'text-muted-foreground hover:text-foreground',
       )}
      >
       <LayoutDashboard className="h-3.5 w-3.5" />
       <span className="hidden sm:inline">Kanban</span>
      </button>
      <button
       onClick={() => setViewMode('list')}
       className={cn(
        'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all',
        viewMode === 'list'
         ? 'bg-background shadow-sm text-foreground border border-border'
         : 'text-muted-foreground hover:text-foreground',
       )}
      >
       <List className="h-3.5 w-3.5" />
       <span className="hidden sm:inline">Lista</span>
      </button>
     </div>
    </div>

    <div className="flex items-center gap-2">
     {viewMode === 'kanban' && (
      <>
       {boards.length > 1 && (
        <Select value={selectedBoardId || ''} onValueChange={setSelectedBoardId}>
         <SelectTrigger className="h-8 w-44 text-xs rounded-full">
          <SelectValue placeholder="Seleccionar tablero" />
         </SelectTrigger>
         <SelectContent>
          {boards.map((b) => (
           <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
          ))}
         </SelectContent>
        </Select>
       )}
       <Button
        variant={showOnlyMyTasks ? 'default' : 'outline'}
        size="sm"
        className="rounded-full"
        onClick={() => setShowOnlyMyTasks(!showOnlyMyTasks)}
       >
        <User className="mr-1.5 h-3.5 w-3.5" />
        Mis tareas
       </Button>
      </>
     )}
     <Button className="rounded-full" size="sm" onClick={() => setCreateOpen(true)}>
      <Plus className="h-4 w-4 mr-1.5" /> Nueva Tarea
     </Button>
    </div>
   </div>

   {/* Kanban View */}
   {viewMode === 'kanban' && (
    <>
     {board ? (
      <KanbanBoard
       boardId={board.id}
       columns={board.columns || []}
       currentUserId={user?.id}
       currentUserRoleId={organization?.roleId}
       showOnlyMyTasks={showOnlyMyTasks}
       onAddColumn={handleAddColumn}
       onEditColumn={handleEditColumn}
       onDeleteColumn={handleDeleteColumn}
       onAddTask={handleAddTask}
       onTaskClick={handleTaskClick}
      />
     ) : (
      <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-border bg-card">
       <p className="text-muted-foreground text-sm">Sin tableros configurados</p>
      </div>
     )}
    </>
   )}

   {/* List View */}
   {viewMode === 'list' && (
    <div className="rounded-xl border border-border bg-card flex flex-col" style={{ height: 'calc(100vh - 14rem)' }}>
     {/* Filters */}
     <div className="flex items-center gap-3 px-6 py-3 border-b">
      <div className="relative flex-1 max-w-xs">
       <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"/>
       <Input placeholder="Buscar tareas..." className="h-8 pl-9 rounded-full text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
       <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Estado"/></SelectTrigger>
       <SelectContent>
        <SelectItem value="ALL">Todos los estados</SelectItem>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
         <SelectItem key={value} value={value}>{label}</SelectItem>
        ))}
       </SelectContent>
      </Select>
      <Select value={priorityFilter} onValueChange={setPriorityFilter}>
       <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Prioridad"/></SelectTrigger>
       <SelectContent>
        <SelectItem value="ALL">Todas</SelectItem>
        {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
         <SelectItem key={value} value={value}>{label}</SelectItem>
        ))}
       </SelectContent>
      </Select>
     </div>

     {/* Table */}
     <div className="flex-1 overflow-auto">
      <table className="w-full">
       <thead className="sticky top-0 bg-muted">
        <tr className="text-xs text-muted-foreground uppercase tracking-wider">
         <th className="text-left px-6 py-2 font-medium">Tarea</th>
         <th className="text-left px-3 py-2 font-medium w-28">Estado</th>
         <th className="text-left px-3 py-2 font-medium w-24">Prioridad</th>
         <th className="text-left px-3 py-2 font-medium w-28">Columna</th>
         <th className="text-left px-3 py-2 font-medium w-20">Asignado</th>
         <th className="text-right px-6 py-2 font-medium w-20">Horas</th>
        </tr>
       </thead>
       <tbody>
        {filteredTasks.map((task) => (
         <tr
          key={task.id}
          onClick={() => router.push(`/projects/${projectId}/tasks/${task.id}`)}
          className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
         >
          <td className="px-6 py-3">
           <p className="text-sm font-medium text-foreground truncate max-w-md">{task.title}</p>
           {task._count?.subTasks > 0 && (
            <span className="text-[10px] text-muted-foreground">{task._count.subTasks} subtarea(s)</span>
           )}
          </td>
          <td className="px-3 py-3">
           <div className="flex items-center gap-1.5">
            <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[task.status])} />
            <span className="text-xs">{STATUS_LABELS[task.status] || task.status}</span>
           </div>
          </td>
          <td className="px-3 py-3">
           <Badge variant="outline" className={cn('text-[10px]', PRIORITY_COLORS[task.priority])}>
            {PRIORITY_LABELS[task.priority] || task.priority}
           </Badge>
          </td>
          <td className="px-3 py-3">
           {task.boardColumn ? (
            <div className="flex items-center gap-1.5">
             <div className="h-2 w-2 rounded-full" style={{ backgroundColor: task.boardColumn.color || '#6366f1' }} />
             <span className="text-xs">{task.boardColumn.name}</span>
            </div>
           ) : (
            <span className="text-xs text-muted-foreground">Sin asignar</span>
           )}
          </td>
          <td className="px-3 py-3">
           <div className="flex -space-x-1">
            {(task.assignments || []).slice(0, 3).map((a: any) => (
             <Avatar key={a.user?.id || a.id} className="h-6 w-6 border-2 border-white">
              <AvatarImage src={a.user?.image} />
              <AvatarFallback className="text-[9px]">{a.user?.name?.charAt(0)}</AvatarFallback>
             </Avatar>
            ))}
           </div>
          </td>
          <td className="px-6 py-3 text-right">
           <span className="text-xs text-muted-foreground">
            {task.estimatedHours ? `${task.estimatedHours}h` : '—'}
           </span>
          </td>
         </tr>
        ))}
       </tbody>
      </table>

      {filteredTasks.length === 0 && (
       <div className="flex flex-col items-center py-16">
        <p className="text-muted-foreground text-sm">No hay tareas</p>
        <Button size="sm" className="mt-4 rounded-full" onClick={() => setCreateOpen(true)}>
         <Plus className="h-4 w-4 mr-2"/> Crear primera tarea
        </Button>
       </div>
      )}
     </div>
    </div>
   )}

   {/* Shared dialogs */}
   <CreateTaskDialog
    projectId={projectId}
    open={createOpen}
    onOpenChange={setCreateTaskOpen}
    onCreated={handleTaskCreated}
    defaultBoardColumnId={createTaskColumnId}
   />

   {board && (
    <ColumnDialog
     boardId={board.id}
     column={editingColumn}
     position={(board.columns || []).length}
     open={columnDialogOpen}
     onOpenChange={setColumnDialogOpen}
     onSaved={handleColumnSaved}
    />
   )}

   <TaskSheet
    taskId={sheetTaskId}
    projectId={projectId}
    open={sheetOpen}
    onOpenChange={setSheetOpen}
    onTaskUpdated={handleTaskUpdated}
   />
  </div>
 );
}
