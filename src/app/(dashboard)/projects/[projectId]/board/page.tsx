'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { KanbanBoard } from '@/components/kanban/board';
import { BoardSettingsDialog } from '@/components/board/board-settings-dialog';
import { ColumnDialog } from '@/components/board/column-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Plus, Layout } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { CreateTaskDialog } from '@/components/task/create-task-dialog';
import { TaskSheet } from '@/components/task/task-sheet';
import { useBoardStore } from '@/stores/use-board-store';

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [boards, setBoards] = useState<any[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [board, setBoard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsBoard, setSettingsBoard] = useState<any>(null);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<any>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createTaskColumnId, setCreateTaskColumnId] = useState<string | undefined>();
  const [sheetTaskId, setSheetTaskId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { addTaskToColumn } = useBoardStore();

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

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const list = await loadBoards();
      if (list.length > 0) {
        setSelectedBoardId(list[0].id);
        await loadBoard(list[0].id);
      }
      setLoading(false);
    };
    init();
  }, [projectId, loadBoards, loadBoard]);

  useEffect(() => {
    if (selectedBoardId) loadBoard(selectedBoardId);
  }, [selectedBoardId, loadBoard]);

  const handleBoardSaved = async () => {
    const list = await loadBoards();
    if (selectedBoardId) {
      const still = list.find((b: any) => b.id === selectedBoardId);
      if (still) {
        await loadBoard(selectedBoardId);
      } else if (list.length > 0) {
        setSelectedBoardId(list[0].id);
      } else {
        setSelectedBoardId(null);
        setBoard(null);
      }
    } else if (list.length > 0) {
      setSelectedBoardId(list[0].id);
    }
  };

  const handleColumnSaved = () => {
    if (selectedBoardId) loadBoard(selectedBoardId);
    setEditingColumn(null);
  };

  const handleAddColumn = () => {
    setEditingColumn(null);
    setColumnDialogOpen(true);
  };

  const handleEditColumn = (column: any) => {
    setEditingColumn(column);
    setColumnDialogOpen(true);
  };

  const handleAddTask = (columnId: string) => {
    setCreateTaskColumnId(columnId);
    setCreateTaskOpen(true);
  };

  const handleTaskCreated = (task: any) => {
    if (createTaskColumnId) {
      addTaskToColumn(createTaskColumnId, task);
    }
  };

  const handleTaskClick = (taskId: string) => {
    setSheetTaskId(taskId);
    setSheetOpen(true);
  };

  const handleTaskUpdated = () => {
    if (selectedBoardId) loadBoard(selectedBoardId);
  };

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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[600px] w-72 shrink-0 rounded-[25px]" />
          ))}
        </div>
      </div>
    );
  }

  if (boards.length === 0 && !board) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="max-w-md rounded-[25px] bg-white p-8 text-center dark:bg-gray-900">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
            <Layout className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-[22px] font-semibold text-gray-800 dark:text-white">Sin Tableros</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Crea tu primer tablero para organizar las tareas de este proyecto con columnas tipo Kanban.
          </p>
          <Button className="mt-6 rounded-full" onClick={() => { setSettingsBoard(null); setSettingsOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Crear Primer Tablero
          </Button>
        </div>

        <BoardSettingsDialog
          projectId={projectId}
          board={null}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onSaved={handleBoardSaved}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Board controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {boards.length > 1 && (
            <Select value={selectedBoardId || ''} onValueChange={setSelectedBoardId}>
              <SelectTrigger className="w-56 rounded-full">
                <SelectValue placeholder="Seleccionar tablero" />
              </SelectTrigger>
              <SelectContent>
                {boards.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => { setSettingsBoard(null); setSettingsOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Tablero
          </Button>
          {board && (
            <button
              onClick={() => { setSettingsBoard(board); setSettingsOpen(true); }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-600 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              title="Configuración del tablero"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      {board && (
        <KanbanBoard
          boardId={board.id}
          columns={board.columns || []}
          onAddColumn={handleAddColumn}
          onEditColumn={handleEditColumn}
          onDeleteColumn={handleDeleteColumn}
          onAddTask={handleAddTask}
          onTaskClick={handleTaskClick}
        />
      )}

      <BoardSettingsDialog
        projectId={projectId}
        board={settingsBoard}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={handleBoardSaved}
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
      <CreateTaskDialog
        projectId={projectId}
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        onCreated={handleTaskCreated}
        defaultBoardColumnId={createTaskColumnId}
      />
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
