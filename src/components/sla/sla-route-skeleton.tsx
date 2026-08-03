import { Skeleton } from '@/components/ui/skeleton';

/** Placeholder compartido por los `loading.tsx` de `/settings/sla/*`. */
export function SlaRouteSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
