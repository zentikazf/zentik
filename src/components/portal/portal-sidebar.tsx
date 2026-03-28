'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, MessageSquarePlus, Bell, LogOut, Sun, Moon } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useNotificationStore } from '@/stores/use-notification-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/lib/api-client';
import { useTheme } from 'next-themes';

const navItems = [
  { name: 'Dashboard', href: '/portal', icon: LayoutDashboard },
  { name: 'Proyectos', href: '/portal/projects', icon: FolderKanban },
  { name: 'Sugerencias', href: '/portal/suggestions', icon: MessageSquarePlus },
  { name: 'Notificaciones', href: '/portal/notifications', icon: Bell },
];

export function PortalSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { unreadCount, setUnreadCount } = useNotificationStore();
  const { theme, setTheme } = useTheme();

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
    if (href === '/portal/suggestions') return pathname.startsWith('/portal/suggestions');
    if (href === '/portal/notifications') return pathname.startsWith('/portal/notifications');
    return false;
  };

  return (
    <aside className="hidden h-full w-[250px] flex-col border-r border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-950 lg:flex shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-between p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
            <FolderKanban className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-800 dark:text-white">Zentik.</span>
        </div>
      </div>

      {/* Main Menu */}
      <nav className="flex-1 px-4 mt-4">
        <div className="mb-6">
          <p className="mb-2 px-5 text-[11px] uppercase tracking-wider text-gray-400">
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
                      ? 'border-l-4 border-blue-600 bg-gray-100 pl-4 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
                      : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[15px] font-medium flex-1">{item.name}</span>
                  {isNotif && unreadCount > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
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
          <p className="mb-2 px-5 text-[11px] uppercase tracking-wider text-gray-400">
            Sistema
          </p>
          <div className="space-y-1">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex w-full items-center gap-4 rounded-lg px-5 py-3 text-gray-500 transition-all hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              <span className="text-[15px] font-medium flex-1 text-left">
                {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* User section */}
      {user && (
        <div className="border-t border-gray-100 p-4 dark:border-gray-800">
          <Link
            href="/portal/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.image || undefined} />
              <AvatarFallback className="bg-blue-100 text-sm focus text-blue-600 dark:bg-blue-900 dark:text-blue-300 font-semibold">
                {getInitials(user.name || '')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-800 dark:text-white">{user.name}</p>
              <p className="truncate text-xs text-gray-400">{user.email}</p>
            </div>
          </Link>
          <button
            onClick={logout}
            className="mt-2 flex w-full items-center gap-4 rounded-lg px-5 py-2.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-red-500 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-red-400"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-[15px] font-medium">Cerrar Sesión</span>
          </button>
        </div>
      )}
    </aside>
  );
}
