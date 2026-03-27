'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Clock, Bell, Settings, FolderKanban, MessageSquarePlus, LogOut, Moon, Sun } from 'lucide-react';
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
  { name: 'Sugerencias', href: '/portal/suggestions', icon: MessageSquarePlus },
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
    if (href === '/portal/suggestions') return pathname.startsWith('/portal/suggestions');
    if (href === '/portal/notifications') return pathname.startsWith('/portal/notifications');
    return false;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-[60px] items-center justify-between bg-black px-6 lg:hidden shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.2)]">
      <div className="flex w-full max-w-md mx-auto items-center justify-between">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          const isNotif = item.href === '/portal/notifications';

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-95"
            >
              <Icon 
                strokeWidth={active ? 2.5 : 2}
                className={cn(
                  'h-6 w-6 transition-all duration-300',
                  active 
                    ? 'text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]' 
                    : 'text-gray-400 hover:text-gray-200'
                )} 
              />
              {isNotif && unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-black">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          );
        })}

        {/* User Profile / Settings Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-transparent transition-all focus:outline-none focus:ring-gray-700 active:scale-95 ml-2">
            <Avatar className="h-8 w-8 border-2 border-transparent hover:border-gray-500 transition-colors bg-gray-900">
              <AvatarImage src={user?.image || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-gray-700 to-gray-900 text-xs font-bold text-white">
                {getInitials(user?.name || '')}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" sideOffset={16} className="w-64 mb-1 rounded-[20px] border-gray-800 bg-gray-950 p-2 text-white shadow-2xl">
            <div className="flex items-center gap-3 p-3 mb-2 rounded-xl bg-gray-900 border border-gray-800">
              <Avatar className="h-10 w-10 border border-gray-700">
                <AvatarImage src={user?.image || undefined} />
                <AvatarFallback className="bg-blue-600 text-sm font-bold text-white">
                  {getInitials(user?.name || '')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{user?.name || 'Cliente'}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
            
            <div className="space-y-1">
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
              </button>
              <Link
                href="/portal/settings"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
              >
                <Settings className="h-4 w-4" />
                Configuración
              </Link>
              <div className="my-1 h-px w-full bg-gray-800" />
              <button
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
