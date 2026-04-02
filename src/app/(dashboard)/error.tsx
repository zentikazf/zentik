'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function DashboardError({
 error,
 reset,
}: {
 error: Error & { digest?: string };
 reset: () => void;
}) {
 return (
 <div className="flex items-center justify-center p-12">
 <Card className="max-w-md p-8 text-center">
 <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive"/>
 <h2 className="text-xl font-bold">Something went wrong</h2>
 <p className="mt-2 text-sm text-muted-foreground">
 {error.message || 'An unexpected error occurred while loading this page.'}
 </p>
 <Button onClick={reset} className="mt-6">
 Try Again
 </Button>
 </Card>
 </div>
 );
}
