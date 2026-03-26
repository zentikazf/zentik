'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderKanban, Bell, LogOut, X, Moon, Sun } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useNotificationStore } from '@/stores/use-notification-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/lib/api-client';
import { useTheme } from 'next-themes';

const navItems = [
  { name: 'Mis Proyectos', href: '/portal', icon: FolderKanban },
  { name: 'Notificaciones', href: '/portal/notifications', icon: Bell },
];

interface PortalSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function PortalSidebar({ isOpen, onClose }: PortalSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { unreadCount, setUnreadCount } = useNotificationStore();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const loadUnread = async () => {
      try {
        const res = await api.get<any>('/notifications/unread-count');
        setUnreadCount(typeof res.data === 'number' ? res.data : res.data?.count ?? 0);
      } catch {}
    };
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, [setUnreadCount]);

  const isActive = (href: string) => {
    if (href === '/portal') return pathname === '/portal' || pathname === '/portal/';
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <aside className="flex h-full w-[260px] flex-col bg-white dark:bg-gray-950 border-r border-gray-100 dark:border-gray-800">
      {/* Logo Header */}
      <div className="flex h-[72px] items-center justify-between px-6 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white text-sm font-bold shadow-sm">
            Z
          </div>
          <div>
            <span className="text-base font-bold text-gray-800 dark:text-white">Zentik</span>
            <p className="text-[11px] font-medium text-blue-500">Portal de Cliente</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 lg:hidden dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        <p className="mb-3 px-3 text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
          Navegacion
        </p>
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          const isNotif = item.href === '/portal/notifications';
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all',
                active
                  ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm dark:bg-blue-950/40 dark:text-blue-400'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5',
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="flex-1">{item.name}</span>
              {isNotif && unreadCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-3">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
        </button>

        {/* User info */}
        <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user?.image || undefined} />
            <AvatarFallback className="bg-blue-100 text-sm font-semibold text-blue-600 dark:bg-blue-900 dark:text-blue-300">
              {getInitials(user?.name || '')}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
              {user?.name || 'Cliente'}
            </p>
            <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesion
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block">{sidebarContent}</div>
      {/* Mobile overlay */}
      <div className="lg:hidden">
        {isOpen && (
          <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
        )}
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out',
            isOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {sidebarContent}
        </div>
      </div>
    </>
  );
}
