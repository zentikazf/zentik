'use client';

import { useParams, useRouter } from 'next/navigation';
import { TaskDetailContent } from '@/components/task/task-detail-content';

/**
 * Page completo de detalle de tarea.
 * Wrapper minimal alrededor del componente compartido TaskDetailContent.
 * El sheet lateral usa el mismo componente con mode="sheet".
 */
export default function TaskDetailPage() {
 const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();
 const router = useRouter();

 return (
 <TaskDetailContent
 taskId={taskId}
 projectId={projectId}
 mode="page"
 onClose={() => router.push(`/projects/${projectId}/board`)}
 />
 );
}
