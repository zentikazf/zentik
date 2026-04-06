'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
 LayoutDashboard,
 Users,
 FolderKanban,
 ClipboardCheck,
 TicketCheck,
 Settings,
 ChevronLeft,
 Sun,
 Moon,
 Menu,
 X,
 LogOut,
 Bell,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn, getInitials } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNotificationStore } from '@/stores/use-notification-store';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NotificationPanel } from '@/components/notifications/notification-panel';

interface NavItem {
 name: string;
 href: string;
 icon: typeof LayoutDashboard;
 permission?: string;
}

const navItems: NavItem[] = [
 { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
 { name: 'Clientes', href: '/clients', icon: Users, permission: 'manage:members' },
 { name: 'Proyectos', href: '/projects', icon: FolderKanban, permission: 'read:projects' },
 { name: 'Aprobaciones', href: '/approvals', icon: ClipboardCheck, permission: 'read:projects' },
 { name: 'Soporte', href: '/tickets', icon: TicketCheck, permission: 'read:projects' },
 { name: 'Configuracion', href: '/settings', icon: Settings, permission: 'manage:members' },
];

interface SidebarProps {
 isOpen?: boolean;
 onClose?: () => void;
 onToggle?: () => void;
}

export function Sidebar({ isOpen, onClose, onToggle }: SidebarProps) {
 const [collapsed, setCollapsed] = useState(false);
 const [notifOpen, setNotifOpen] = useState(false);
 const pathname = usePathname();
 const { user, logout } = useAuth();
 const { hasPermission, roleName } = usePermissions();
 const { theme, setTheme } = useTheme();
 const { unreadCount } = useNotificationStore();

 const isActive = (href: string) => {
 if (href === '/dashboard') return pathname === '/' || pathname === '/dashboard';
 return pathname.startsWith(href);
 };

 const visibleItems = navItems.filter(
 (item) => !item.permission || hasPermission(item.permission),
 );

 const renderNavItem = (item: NavItem) => {
 const active = isActive(item.href);
 const Icon = item.icon;

 return (
 <Link
 key={item.name}
 href={item.href}
 onClick={onClose}
 className={cn(
 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
 active
 ? 'bg-sidebar-accent text-sidebar-accent-foreground'
 : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
 collapsed && 'justify-center px-2',
 )}
 title={collapsed ? item.name : undefined}
 >
 <Icon className="h-5 w-5 shrink-0"/>
 {!collapsed && <span className="animate-fade-in">{item.name}</span>}
 </Link>
 );
 };

 // Desktop sidebar content
 const desktopSidebar = (
 <aside
 className={cn(
 'hidden md:flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300',
 collapsed ? 'w-[68px]' : 'w-[220px]',
 )}
 >
 {/* Logo */}
 <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
 <img src="https://onnix.com.py/assets/img/logo.svg" alt="Onnix" className="h-8 w-8 shrink-0" />
 {!collapsed && (
 <span className="text-lg font-bold text-sidebar-foreground animate-fade-in">
 Onnix
 </span>
 )}
 </div>

 {/* Navigation */}
 <nav className="flex-1 space-y-1 p-3">
 {visibleItems.map(renderNavItem)}
 </nav>

 {/* Footer */}
 <div className="border-t border-sidebar-border p-3 space-y-1">
 {/* User profile */}
 {user && (
 <Link
 href="/profile"
 className={cn(
 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent/50',
 collapsed && 'justify-center px-2',
 )}
 >
 <Avatar className="h-7 w-7 shrink-0">
 <AvatarImage src={user.image || undefined} />
 <AvatarFallback className="bg-muted text-xs font-medium">
 {getInitials(user.name || '')}
 </AvatarFallback>
 </Avatar>
 {!collapsed && (
 <div className="min-w-0 flex-1 animate-fade-in">
 <p className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</p>
 <p className="truncate text-xs text-sidebar-foreground/50">{roleName || user.email}</p>
 </div>
 )}
 </Link>
 )}

 {/* Notifications */}
 <Popover open={notifOpen} onOpenChange={setNotifOpen}>
 <PopoverTrigger asChild>
 <button
 className={cn(
 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
 collapsed && 'justify-center px-2',
 )}
 >
 <div className="relative shrink-0">
 <Bell className="h-5 w-5"/>
 {unreadCount > 0 && (
 <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold text-destructive-foreground">
 {unreadCount > 9 ? '9+' : unreadCount}
 </span>
 )}
 </div>
 {!collapsed && <span className="animate-fade-in">Notificaciones</span>}
 </button>
 </PopoverTrigger>
 <PopoverContent side="right"align="end"className="w-80 md:w-96 p-0">
 <NotificationPanel open={notifOpen} />
 </PopoverContent>
 </Popover>

 {/* Dark mode toggle */}
 <button
 onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
 className={cn(
 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
 collapsed && 'justify-center px-2',
 )}
 >
 {theme === 'dark' ? <Sun className="h-5 w-5 shrink-0"/> : <Moon className="h-5 w-5 shrink-0"/>}
 {!collapsed && (
 <span className="animate-fade-in">
 {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
 </span>
 )}
 </button>

 {/* Collapse toggle */}
 <button
 onClick={() => setCollapsed(!collapsed)}
 className={cn(
 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
 collapsed && 'justify-center px-2',
 )}
 >
 <ChevronLeft
 className={cn(
 'h-5 w-5 shrink-0 transition-transform duration-300',
 collapsed && 'rotate-180',
 )}
 />
 {!collapsed && <span className="animate-fade-in">Colapsar</span>}
 </button>

 {/* Logout */}
 <button
 onClick={logout}
 className={cn(
 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive',
 collapsed && 'justify-center px-2',
 )}
 >
 <LogOut className="h-5 w-5 shrink-0"/>
 {!collapsed && <span className="animate-fade-in">Cerrar sesion</span>}
 </button>
 </div>
 </aside>
 );

 // Mobile top bar + drawer
 const mobileSidebar = (
 <>
 {/* Fixed top bar */}
 <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4">
 <div className="flex items-center gap-2">
 <button
 onClick={onToggle}
 className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent"
 >
 <Menu className="h-5 w-5"/>
 </button>
 <div className="flex items-center gap-2">
 <img src="https://onnix.com.py/assets/img/logo.svg" alt="Onnix" className="h-7 w-7" />
 <span className="text-lg font-bold text-sidebar-foreground">Onnix</span>
 </div>
 </div>
 </div>

 {/* Overlay */}
 {isOpen && (
 <div
 className="md:hidden fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
 onClick={onClose}
 />
 )}

 {/* Drawer */}
 <div
 className={cn(
 'md:hidden fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-300',
 isOpen ? 'translate-x-0' : '-translate-x-full',
 )}
 >
 {/* Drawer header */}
 <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
 <div className="flex items-center gap-2">
 <img src="https://onnix.com.py/assets/img/logo.svg" alt="Onnix" className="h-8 w-8" />
 <span className="text-lg font-bold text-sidebar-foreground">Onnix</span>
 </div>
 <button
 onClick={onClose}
 className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent"
 >
 <X className="h-5 w-5"/>
 </button>
 </div>

 {/* Drawer nav */}
 <nav className="flex-1 space-y-1 p-3">
 {visibleItems.map((item) => {
 const active = isActive(item.href);
 const Icon = item.icon;
 return (
 <Link
 key={item.name}
 href={item.href}
 onClick={onClose}
 className={cn(
 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
 active
 ? 'bg-sidebar-accent text-sidebar-accent-foreground'
 : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
 )}
 >
 <Icon className="h-5 w-5"/>
 <span>{item.name}</span>
 </Link>
 );
 })}
 </nav>

 {/* Drawer footer */}
 <div className="border-t border-sidebar-border p-3 space-y-1">
 {user && (
 <Link
 href="/profile"
 onClick={onClose}
 className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent/50"
 >
 <Avatar className="h-7 w-7">
 <AvatarImage src={user.image || undefined} />
 <AvatarFallback className="bg-muted text-xs font-medium">
 {getInitials(user.name || '')}
 </AvatarFallback>
 </Avatar>
 <div className="min-w-0 flex-1">
 <p className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</p>
 <p className="truncate text-xs text-sidebar-foreground/50">{roleName || user.email}</p>
 </div>
 </Link>
 )}
 <button
 onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
 className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
 >
 {theme === 'dark' ? <Sun className="h-5 w-5"/> : <Moon className="h-5 w-5"/>}
 <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
 </button>
 <button
 onClick={logout}
 className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive"
 >
 <LogOut className="h-5 w-5"/>
 <span>Cerrar sesion</span>
 </button>
 </div>
 </div>
 </>
 );

 return (
 <>
 {desktopSidebar}
 {mobileSidebar}
 </>
 );
}
