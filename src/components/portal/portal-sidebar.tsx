'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, Ticket, Bell, LogOut, Sun, Moon } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useNotificationStore } from '@/stores/use-notification-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/lib/api-client';
import { useSocket } from '@/hooks/use-socket';
import { useTheme } from 'next-themes';

const navItems = [
 { name: 'Dashboard', href: '/portal', icon: LayoutDashboard },
 { name: 'Proyectos', href: '/portal/projects', icon: FolderKanban },
 { name: 'Tickets', href: '/portal/tickets', icon: Ticket },
 { name: 'Notificaciones', href: '/portal/notifications', icon: Bell },
];

export function PortalSidebar() {
 const pathname = usePathname();
 const { user, logout } = useAuth();
 const { unreadCount, setUnreadCount } = useNotificationStore();
 const { theme, setTheme } = useTheme();

 // Listen for real-time notification push
 useSocket({
 'notification:new': () => {
 setUnreadCount(unreadCount + 1);
 },
 });

 useEffect(() => {
 const loadUnread = async () => {
 if (document.visibilityState === 'hidden') return;
 try {
 const res = await api.get<any>('/notifications/unread-count');
 setUnreadCount(typeof res.data === 'number' ? res.data : res.data?.count ?? 0);
 } catch {}
 };
 loadUnread();
 const interval = setInterval(loadUnread, 60000);

 const handleVisibility = () => {
 if (document.visibilityState === 'visible') loadUnread();
 };
 document.addEventListener('visibilitychange', handleVisibility);

 return () => {
 clearInterval(interval);
 document.removeEventListener('visibilitychange', handleVisibility);
 };
 }, [setUnreadCount]);

 const isActive = (href: string) => {
 if (href === '/portal') return pathname === '/portal' || pathname === '/portal/';
 if (href === '/portal/projects') return pathname.startsWith('/portal/projects');
 if (href === '/portal/tickets') return pathname.startsWith('/portal/tickets');
 if (href === '/portal/notifications') return pathname.startsWith('/portal/notifications');
 return false;
 };

 return (
 <aside className="hidden h-full w-[250px] flex-col border-r border-border bg-card lg:flex shrink-0">
 {/* Logo */}
 <div className="flex items-center justify-between p-6">
 <div className="flex items-center gap-2">
 <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
 <FolderKanban className="h-5 w-5 text-white"/>
 </div>
 <span className="text-xl font-bold text-foreground">Zentik.</span>
 </div>
 </div>

 {/* Main Menu */}
 <nav className="flex-1 px-4 mt-4">
 <div className="mb-6">
 <p className="mb-2 px-5 text-[11px] uppercase tracking-wider text-muted-foreground">
 Principal
 </p>
 <div className="space-y-1">
 {navItems.map((item) => {
 const active = isActive(item.href);
 const Icon = item.icon;
 const isNotif = item.href === '/portal/notifications';

 return (
 <Link
 key={item.name}
 href={item.href}
 className={cn(
 'flex w-full items-center gap-4 rounded-lg px-5 py-3 transition-all',
 active
 ? 'border-l-4 border-primary bg-muted pl-4 text-primary'
 : 'text-muted-foreground hover:bg-muted'
 )}
 >
 <Icon className="h-5 w-5"/>
 <span className="text-[15px] font-medium flex-1">{item.name}</span>
 {isNotif && unreadCount > 0 && (
 <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
 {unreadCount > 9 ? '9+' : unreadCount}
 </span>
 )}
 </Link>
 );
 })}
 </div>
 </div>

 {/* Switch Theme Section */}
 <div className="mb-6">
 <p className="mb-2 px-5 text-[11px] uppercase tracking-wider text-muted-foreground">
 Sistema
 </p>
 <div className="space-y-1">
 <button
 onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
 className="flex w-full items-center gap-4 rounded-lg px-5 py-3 text-muted-foreground transition-all hover:bg-muted"
 >
 {theme === 'dark' ? <Sun className="h-5 w-5"/> : <Moon className="h-5 w-5"/>}
 <span className="text-[15px] font-medium flex-1 text-left">
 {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
 </span>
 </button>
 </div>
 </div>
 </nav>

 {/* User section */}
 {user && (
 <div className="border-t border-border p-4">
 <Link
 href="/portal/settings"
 className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
 >
 <Avatar className="h-10 w-10">
 <AvatarImage src={user.image || undefined} />
 <AvatarFallback className="bg-primary/15 text-sm focus text-primary font-semibold">
 {getInitials(user.name || '')}
 </AvatarFallback>
 </Avatar>
 <div className="min-w-0 flex-1">
 <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
 <p className="truncate text-xs text-muted-foreground">{user.email}</p>
 </div>
 </Link>
 <button
 onClick={logout}
 className="mt-2 flex w-full items-center gap-4 rounded-lg px-5 py-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
 >
 <LogOut className="h-5 w-5"/>
 <span className="text-[15px] font-medium">Cerrar Sesión</span>
 </button>
 </div>
 )}
 </aside>
 );
}
