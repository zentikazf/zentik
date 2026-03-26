'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Clock } from 'lucide-react';
import { useTimer } from '@/hooks/use-timer';
import { cn, formatDuration } from '@/lib/utils';

interface TimerWidgetProps {
  taskId?: string;
  taskTitle?: string;
  className?: string;
}

export function TimerWidget({ taskId, taskTitle, className }: TimerWidgetProps) {
  const { isRunning, activeTimer, start, stop } = useTimer();
  const elapsed = activeTimer?.elapsed ?? 0;

  const handleToggle = async () => {
    if (isRunning) {
      await stop();
    } else if (taskId) {
      await start(taskId);
    }
  };

  const displayTaskTitle = taskTitle;

  return (
    <Card className={cn('flex items-center gap-3 p-3', className)}>
      <Button
        variant={isRunning ? 'destructive' : 'default'}
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={handleToggle}
        disabled={!taskId && !isRunning}
      >
        {isRunning ? (
          <Square className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </Button>

      <div className="min-w-0 flex-1">
        {displayTaskTitle ? (
          <p className="truncate text-sm font-medium">{displayTaskTitle}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No task selected</p>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span
          className={cn(
            'font-mono text-sm tabular-nums',
            isRunning && 'text-primary font-semibold',
          )}
        >
          {formatDuration(elapsed)}
        </span>
      </div>

      {isRunning && (
        <Badge variant="secondary" className="animate-pulse text-xs">
          Recording
        </Badge>
      )}
    </Card>
  );
}
