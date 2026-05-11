import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Skeleton className="h-10 w-48 rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
