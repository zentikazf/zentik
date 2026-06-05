'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function MembersSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <Skeleton className="h-5 w-48 rounded-md" />
          <Skeleton className="h-4 w-4 rounded-md" />
        </div>
        <div className="border-t border-border px-4 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4"
              >
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4 rounded-md" />
                    <Skeleton className="h-3 w-full rounded-md" />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-4 w-16 rounded-md" />
                  <Skeleton className="ml-auto h-3 w-12 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
