import { create } from 'zustand';
import type { Board, BoardColumn, Task } from '@/types';

interface BoardStore {
  board: Board | null;
  columns: BoardColumn[];
  loading: boolean;
  setBoard: (board: Board) => void;
  setColumns: (columns: BoardColumn[]) => void;
  moveTask: (taskId: string, fromColumnId: string, toColumnId: string, position: number) => void;
  addTaskToColumn: (columnId: string, task: Task) => void;
  removeTaskFromColumn: (columnId: string, taskId: string) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  setLoading: (loading: boolean) => void;
}

export const useBoardStore = create<BoardStore>((set) => ({
  board: null,
  columns: [],
  loading: false,
  setBoard: (board) => set({ board }),
  setColumns: (columns) => set({ columns }),
  moveTask: (taskId, fromColumnId, toColumnId, position) =>
    set((state) => {
      const newColumns = state.columns.map((col) => {
        if (col.id === fromColumnId) {
          return {
            ...col,
            tasks: (col.tasks || []).filter((t) => t.id !== taskId),
          };
        }
        if (col.id === toColumnId) {
          const task = state.columns
            .find((c) => c.id === fromColumnId)
            ?.tasks?.find((t) => t.id === taskId);
          if (!task) return col;
          const tasks = [...(col.tasks || [])];
          tasks.splice(position, 0, { ...task, boardColumnId: toColumnId });
          return { ...col, tasks };
        }
        return col;
      });
      return { columns: newColumns };
    }),
  addTaskToColumn: (columnId, task) =>
    set((state) => ({
      columns: state.columns.map((col) =>
        col.id === columnId ? { ...col, tasks: [...(col.tasks || []), task] } : col,
      ),
    })),
  removeTaskFromColumn: (columnId, taskId) =>
    set((state) => ({
      columns: state.columns.map((col) =>
        col.id === columnId
          ? { ...col, tasks: (col.tasks || []).filter((t) => t.id !== taskId) }
          : col,
      ),
    })),
  updateTask: (taskId, updates) =>
    set((state) => ({
      columns: state.columns.map((col) => ({
        ...col,
        tasks: (col.tasks || []).map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
      })),
    })),
  setLoading: (loading) => set({ loading }),
}));
