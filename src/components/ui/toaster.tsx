'use client';

import { useEffect, useRef, useState } from 'react';
import {
 X, CheckCircle2, AlertCircle, Bell, UserPlus, ClipboardCheck,
 XCircle, AtSign, Zap, Calendar, MessageSquare, ShieldCheck,
 ShieldX, FileText, Users, RefreshCw,
} from 'lucide-react';
import { useToastStore, type ToastData, type NotificationType } from '@/hooks/use-toast';

const NOTIFICATION_CONFIG: Record<NotificationType, {
 icon: typeof Bell;
 gradient: string;
 iconColor: string;
 borderColor: string;
 bgColor: string;
}> = {
 TASK_ASSIGNED: { icon: UserPlus, gradient: 'from-primary/100 to-blue-600', iconColor: 'text-white', borderColor: 'border-primary/30', bgColor: 'bg-primary/10/40' },
 TASK_UPDATED: { icon: RefreshCw, gradient: 'from-amber-500 to-orange-500', iconColor: 'text-white', borderColor: 'border-warning/30', bgColor: 'bg-warning/10/40' },
 TASK_COMPLETED: { icon: CheckCircle2, gradient: 'from-emerald-500 to-green-600', iconColor: 'text-white', borderColor: 'border-success/30', bgColor: 'bg-success/10' },
 TASK_APPROVAL_REQUESTED: { icon: ClipboardCheck, gradient: 'from-violet-500 to-purple-600', iconColor: 'text-white', borderColor: 'border-info/30', bgColor: 'bg-info/10' },
 TASK_APPROVAL_APPROVED: { icon: ShieldCheck, gradient: 'from-emerald-500 to-teal-600', iconColor: 'text-white', borderColor: 'border-success/30', bgColor: 'bg-success/10' },
 TASK_APPROVAL_REJECTED: { icon: ShieldX, gradient: 'from-red-500 to-rose-600', iconColor: 'text-white', borderColor: 'border-destructive/30', bgColor: 'bg-destructive/10/40' },
 MENTION: { icon: AtSign, gradient: 'from-orange-500 to-amber-600', iconColor: 'text-white', borderColor: 'border-warning/30', bgColor: 'bg-warning/10' },
 SPRINT_STARTED: { icon: Zap, gradient: 'from-indigo-500 to-blue-600', iconColor: 'text-white', borderColor: 'border-info/30', bgColor: 'bg-info/10' },
 SPRINT_COMPLETED: { icon: CheckCircle2, gradient: 'from-teal-500 to-cyan-600', iconColor: 'text-white', borderColor: 'border-success/30', bgColor: 'bg-success/10' },
 ALCANCE_SUBMITTED: { icon: FileText, gradient: 'from-sky-500 to-blue-600', iconColor: 'text-white', borderColor: 'border-info/30', bgColor: 'bg-info/10' },
 ALCANCE_APPROVED: { icon: ShieldCheck, gradient: 'from-emerald-500 to-green-600', iconColor: 'text-white', borderColor: 'border-success/30', bgColor: 'bg-success/10' },
 ALCANCE_REJECTED: { icon: XCircle, gradient: 'from-red-500 to-rose-600', iconColor: 'text-white', borderColor: 'border-destructive/30', bgColor: 'bg-destructive/10/40' },
 MEETING_SCHEDULED: { icon: Calendar, gradient: 'from-cyan-500 to-blue-600', iconColor: 'text-white', borderColor: 'border-info/30', bgColor: 'bg-info/10' },
 SUGGESTION_RECEIVED: { icon: MessageSquare, gradient: 'from-pink-500 to-rose-600', iconColor: 'text-white', borderColor: 'border-destructive/30', bgColor: 'bg-destructive/10' },
 MEMBER_JOINED: { icon: Users, gradient: 'from-primary/100 to-indigo-600', iconColor: 'text-white', borderColor: 'border-primary/30', bgColor: 'bg-primary/10/40' },
 MEMBER_REMOVED: { icon: Users, gradient: 'from-gray-500 to-slate-600', iconColor: 'text-white', borderColor: 'border-border', bgColor: 'bg-muted' },
 COMMENT_ADDED: { icon: MessageSquare, gradient: 'from-primary/100 to-sky-600', iconColor: 'text-white', borderColor: 'border-primary/30', bgColor: 'bg-primary/10/40' },
 default: { icon: Bell, gradient: 'from-primary/100 to-blue-600', iconColor: 'text-white', borderColor: 'border-primary/30', bgColor: 'bg-primary/10/40' },
};

function NotificationToast({ t, onDismiss }: { t: ToastData; onDismiss: (id: string) => void }) {
 const config = NOTIFICATION_CONFIG[t.notificationType || 'default'] || NOTIFICATION_CONFIG.default;
 const Icon = config.icon;
 const [progress, setProgress] = useState(100);
 const [isPaused, setIsPaused] = useState(false);
 const [translateX, setTranslateX] = useState(0);
 const [isDragging, setIsDragging] = useState(false);
 const startXRef = useRef(0);
 const containerRef = useRef<HTMLDivElement>(null);

 // Progress bar countdown
 useEffect(() => {
 if (isPaused) return;
 const duration = t.duration || 10000;
 const interval = 50;
 const step = (interval / duration) * 100;

 const timer = setInterval(() => {
 setProgress((prev) => {
 if (prev <= 0) {
 clearInterval(timer);
 return 0;
 }
 return prev - step;
 });
 }, interval);

 return () => clearInterval(timer);
 }, [isPaused, t.duration]);

 // Swipe to dismiss
 const handlePointerDown = (e: React.PointerEvent) => {
 startXRef.current = e.clientX;
 setIsDragging(true);
 (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
 };

 const handlePointerMove = (e: React.PointerEvent) => {
 if (!isDragging) return;
 const diff = e.clientX - startXRef.current;
 if (diff > 0) setTranslateX(diff);
 };

 const handlePointerUp = () => {
 setIsDragging(false);
 if (translateX > 120) {
 onDismiss(t.id);
 } else {
 setTranslateX(0);
 }
 };

 return (
 <div
 ref={containerRef}
 onPointerDown={handlePointerDown}
 onPointerMove={handlePointerMove}
 onPointerUp={handlePointerUp}
 onMouseEnter={() => setIsPaused(true)}
 onMouseLeave={() => setIsPaused(false)}
 style={{
 transform: `translateX(${translateX}px)`,
 opacity: translateX > 80 ? 1 - (translateX - 80) / 120 : 1,
 transition: isDragging ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
 }}
 className={`pointer-events-auto relative w-full overflow-hidden rounded-2xl border ${config.borderColor} ${config.bgColor} backdrop-blur-sm shadow-[0_8px_40px_-12px_rgba(0,0,0,0.25)]`}
 >
 {/* Top accent gradient line */}
 <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${config.gradient}`} />

 <div className="flex items-start gap-4 p-5 pr-10 pt-6">
 {/* Icon with gradient background */}
 <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${config.gradient} shadow-lg`}>
 <Icon className={`h-6 w-6 ${config.iconColor}`} />
 </div>

 <div className="min-w-0 flex-1">
 {/* App name */}
 <div className="flex items-center gap-2 mb-1">
 <div className="flex h-4 w-4 items-center justify-center rounded bg-primary text-[8px] font-bold text-white">Z</div>
 <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Zentik</span>
 <span className="text-[11px] text-muted-foreground/50">·</span>
 <span className="text-[11px] text-muted-foreground">ahora</span>
 </div>

 {/* Title */}
 <p className="text-[15px] font-semibold text-foreground leading-tight">{t.title}</p>

 {/* Description */}
 {t.description && (
 <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed line-clamp-3">{t.description}</p>
 )}
 </div>

 {/* Dismiss button */}
 <button
 onClick={(e) => { e.stopPropagation(); onDismiss(t.id); }}
 className="absolute right-3 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-black/5 hover:text-muted-foreground/30 transition-colors"
 >
 <X className="h-4 w-4"/>
 </button>
 </div>

 {/* Progress bar — auto dismiss countdown */}
 <div className="h-[3px] w-full bg-black/5 /5">
 <div
 className={`h-full bg-gradient-to-r ${config.gradient} transition-all duration-100 ease-linear`}
 style={{ width: `${progress}%` }}
 />
 </div>

 {/* Swipe hint */}
 {translateX > 20 && (
 <div className="absolute inset-y-0 right-4 flex items-center">
 <span className="text-xs text-muted-foreground font-medium">Desliza →</span>
 </div>
 )}
 </div>
 );
}

export function Toaster() {
 const { toasts, addToast, dismissToast, subscribe } = useToastStore();

 useEffect(() => {
 return subscribe(addToast);
 }, [subscribe, addToast]);

 if (toasts.length === 0) return null;

 const notifToasts = toasts.filter((t) => t.variant === 'notification');
 const regularToasts = toasts.filter((t) => t.variant !== 'notification');

 return (
 <>
 {/* Notification toasts — top-right, phone-style */}
 {notifToasts.length > 0 && (
 <div className="fixed top-0 right-0 z-[200] flex w-full flex-col gap-3 p-4 sm:max-w-[420px]">
 {notifToasts.map((t) => (
 <NotificationToast key={t.id} t={t} onDismiss={dismissToast} />
 ))}
 </div>
 )}

 {/* Regular toasts — bottom-right */}
 {regularToasts.length > 0 && (
 <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-[420px]">
 {regularToasts.map((t) => (
 <div
 key={t.id}
 className={`pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-md border p-4 pr-8 shadow-lg animate-in slide-in-from-bottom-5 ${
 t.variant === 'destructive'
 ? 'border-destructive/30 bg-destructive/10 text-destructive'
 : t.variant === 'success'
 ? 'border-success/30 bg-success/10 text-success'
 : 'border bg-background text-foreground'
 }`}
 >
 {t.variant === 'destructive' && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive"/>}
 {t.variant === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success"/>}
 <div className="min-w-0 flex-1">
 <p className="text-sm font-semibold">{t.title}</p>
 {t.description && <p className="mt-1 text-sm opacity-80">{t.description}</p>}
 </div>
 <button
 onClick={() => dismissToast(t.id)}
 className="absolute right-2 top-2 rounded-md p-1 opacity-50 hover:opacity-100"
 >
 <X className="h-3 w-3"/>
 </button>
 </div>
 ))}
 </div>
 )}
 </>
 );
}
