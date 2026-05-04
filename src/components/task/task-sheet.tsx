'use client';

import {
 Sheet,
 SheetContent,
} from '@/components/ui/sheet';
import { TaskDetailContent } from './task-detail-content';

interface TaskSheetProps {
 taskId: string | null;
 projectId: string;
 open: boolean;
 onOpenChange: (open: boolean) => void;
 onTaskUpdated?: () => void;
}

/**
 * Wrapper del sheet lateral para detalle de tarea.
 * Toda la logica vive en TaskDetailContent (compartido con el page completo).
 */
export function TaskSheet({ taskId, projectId, open, onOpenChange, onTaskUpdated }: TaskSheetProps) {
 return (
 <Sheet open={open} onOpenChange={onOpenChange}>
 <SheetContent side="right" className="w-full sm:max-w-[640px] p-0 flex flex-col overflow-hidden">
 {taskId && (
 <TaskDetailContent
 taskId={taskId}
 projectId={projectId}
 mode="sheet"
 onUpdated={onTaskUpdated}
 onClose={() => onOpenChange(false)}
 />
 )}
 </SheetContent>
 </Sheet>
 );
}
