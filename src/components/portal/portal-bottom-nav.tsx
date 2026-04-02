'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Clock, Bell, Settings, FolderKanban, Ticket, LogOut, Moon, Sun } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useNotificationStore } from '@/stores/use-notification-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from 'next-themes';

const navItems = [
 { name: 'Inicio', href: '/portal', icon: LayoutDashboard },
 { name: 'Proyectos', href: '/portal/projects', icon: FolderKanban },
 { name: 'Tickets', href: '/portal/tickets', icon: Ticket },
 { name: 'Notificaciones', href: '/portal/notifications', icon: Bell },
];

export function PortalBottomNav() {
 const pathname = usePathname();
 const { user, logout } = useAuth();
 const { unreadCount } = useNotificationStore();
 const { theme, setTheme } = useTheme();

 const isActive = (href: string) => {
 if (href === '/portal') return pathname === '/portal' || pathname === '/portal/';
 if (href === '/portal/projects') return pathname.startsWith('/portal/projects');
 if (href === '/portal/tickets') return pathname.startsWith('/portal/tickets');
 if (href === '/portal/notifications') return pathname.startsWith('/portal/notifications');
 return false;
 };

 return (
 <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-[70px] pb-2 items-center justify-between bg-card/80 backdrop-blur-xl px-6 lg:hidden shadow-[0_-10px_40px_rgba(37,99,235,0.05)] /80 border-t border-border/50/50">
 <div className="flex w-full max-w-sm mx-auto items-center justify-between">
 {navItems.map((item) => {
 const active = isActive(item.href);
 const Icon = item.icon;
 const isNotif = item.href === '/portal/notifications';

 return (
 <Link
 key={item.href}
 href={item.href}
 className="relative flex flex-col items-center justify-center w-14 transition-transform active:scale-95 group"
 >
 <div 
 className={cn(
 'flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300',
 active 
 ? 'bg-primary/10 text-primary rotate-0 scale-100 shadow-sm' 
 : 'text-muted-foreground hover:text-muted-foreground hover:bg-muted scale-95 hover:scale-100'
 )}
 >
 <Icon 
 strokeWidth={active ? 2.5 : 2}
 className="h-6 w-6"
 />
 </div>
 {isNotif && unreadCount > 0 && (
 <span className="absolute top-0 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white ring-2 ring-background">
 {unreadCount > 9 ? '9+' : unreadCount}
 </span>
 )}
 </Link>
 );
 })}

 {/* User Profile / Settings Menu */}
 <DropdownMenu>
 <DropdownMenuTrigger className="flex h-12 w-12 items-center justify-center rounded-2xl ring-2 ring-transparent transition-all focus:outline-none focus:ring-ring/50 active:scale-95 ml-2 hover:bg-muted">
 <Avatar className="h-9 w-9 border border-border transition-colors shadow-sm">
 <AvatarImage src={user?.image || undefined} />
 <AvatarFallback className="bg-gradient-to-br from-primary/100 to-indigo-600 text-xs font-bold text-white">
 {getInitials(user?.name || '')}
 </AvatarFallback>
 </Avatar>
 </DropdownMenuTrigger>
 <DropdownMenuContent side="top"align="end"sideOffset={16} className="w-64 mb-3 rounded-[24px] border-border/50 bg-card/90 backdrop-blur-xl p-2 text-foreground shadow-2xl/50 /90">
 <div className="flex items-center gap-3 p-3 mb-2 rounded-xl bg-muted/50/50 border border-border">
 <Avatar className="h-10 w-10 border border-border shadow-sm">
 <AvatarImage src={user?.image || undefined} />
 <AvatarFallback className="bg-primary text-sm font-bold text-white">
 {getInitials(user?.name || '')}
 </AvatarFallback>
 </Avatar>
 <div className="min-w-0 flex-1">
 <p className="text-sm font-bold text-foreground truncate">{user?.name || 'Cliente'}</p>
 <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
 </div>
 </div>
 
 <div className="space-y-1">
 <button
 onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
 className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary "
 >
 {theme === 'dark' ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}
 {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
 </button>
 <Link
 href="/portal/settings"
 className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary "
 >
 <Settings className="h-4 w-4"/>
 Configuración
 </Link>
 <div className="my-1 h-px w-full bg-muted"/>
 <button
 onClick={logout}
 className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
 >
 <LogOut className="h-4 w-4"/>
 Cerrar sesión
 </button>
 </div>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </nav>
 );
}
