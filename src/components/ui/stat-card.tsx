import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
 title: string;
 value: string | number;
 subtitle?: string;
 icon: LucideIcon;
 trend?: { value: number; positive: boolean };
 className?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, className }: StatCardProps) {
 return (
 <div className={cn('rounded-xl border border-border bg-card p-5 animate-fade-in', className)}>
 <div className="flex items-start justify-between">
 <div className="space-y-1">
 <p className="text-sm font-medium text-muted-foreground">{title}</p>
 <p className="text-2xl font-bold tracking-tight text-card-foreground animate-count-up">
 {value}
 </p>
 {subtitle && (
 <p className="text-xs text-muted-foreground">{subtitle}</p>
 )}
 {trend && (
 <p className={cn('text-xs font-medium', trend.positive ? 'text-success' : 'text-destructive')}>
 {trend.positive ? '+' : ''}{trend.value}% vs mes anterior
 </p>
 )}
 </div>
 <div className="rounded-lg bg-accent p-2.5">
 <Icon className="h-5 w-5 text-accent-foreground"/>
 </div>
 </div>
 </div>
 );
}
