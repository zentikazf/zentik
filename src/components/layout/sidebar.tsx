'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  Calendar,
  BarChart3,
  Users,
  MessageSquare,
  Settings,
  Shield,
  LogOut,
  Building,
  X,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: string;
}

const mainItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clientes', href: '/clients', icon: Building, permission: 'manage:members' },
  { name: 'Proyectos', href: '/projects', icon: FolderKanban, permission: 'read:projects' },
  { name: 'Calendario', href: '/calendar', icon: Calendar },
  { name: 'Reportes', href: '/reports', icon: BarChart3, permission: 'read:projects' },
  { name: 'Equipo', href: '/team', icon: Users, permission: 'read:members' },
  { name: 'Chat', href: '/chat', icon: MessageSquare, permission: 'read:chat' },
];

const adminItems: NavItem[] = [
  { name: 'Configuración', href: '/settings', icon: Settings, permission: 'manage:members' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { hasPermission, roleName } = usePermissions();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/' || pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const visibleMainItems = mainItems.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  const visibleAdminItems = adminItems.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    const Icon = item.icon;

    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={onClose}
        className={cn(
          'flex w-full items-center gap-4 rounded-lg px-5 py-3 transition-all',
          active
            ? 'border-l-4 border-blue-600 bg-gray-100 pl-4 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
            : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5',
        )}
      >
        <Icon className="h-5 w-5" />
        <span className="text-[15px] font-medium">{item.name}</span>
      </Link>
    );
  };

  const sidebarContent = (
    <aside className="flex h-screen w-[250px] flex-col border-r border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-950">
      {/* Logo */}
      <div className="flex items-center justify-between p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
            <FolderKanban className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-800 dark:text-white">Zentik.</span>
        </div>
        {/* Close button - mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Main Menu */}
      <nav className="flex-1 px-4 mt-4">
        <div className="mb-6">
          <p className="mb-2 px-5 text-[11px] uppercase tracking-wider text-gray-400">
            Principal
          </p>
          <div className="space-y-1">
            {visibleMainItems.map(renderItem)}
          </div>
        </div>

        {visibleAdminItems.length > 0 && (
          <div>
            <p className="mb-2 px-5 text-[11px] uppercase tracking-wider text-gray-400">
              Administración
            </p>
            <div className="space-y-1">
              {visibleAdminItems.map(renderItem)}
            </div>
          </div>
        )}
      </nav>

      {/* User section */}
      {user && (
        <div className="border-t border-gray-100 p-4 dark:border-gray-800">
          <Link
            href="/profile"
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.image || undefined} />
              <AvatarFallback className="bg-blue-100 text-sm text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                {getInitials(user.name || '')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-800 dark:text-white">{user.name}</p>
              <p className="truncate text-xs text-gray-400">{roleName || user.email}</p>
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

  return (
    <>
      {/* Desktop sidebar - always visible on lg+ */}
      <div className="hidden lg:block">
        {sidebarContent}
      </div>

      {/* Mobile sidebar - overlay */}
      <div className="lg:hidden">
        {/* Backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 transition-opacity"
            onClick={onClose}
          />
        )}
        {/* Slide-out panel */}
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
