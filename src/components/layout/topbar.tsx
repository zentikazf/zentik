'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Search, User, Settings, Shield, LogOut, Moon, Sun, ChevronsUpDown, Building2, Check, Plus, KeyRound, Menu, FolderKanban } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useNotificationStore } from '@/stores/use-notification-store';
import { useAuth } from '@/hooks/use-auth';
import { useOrg } from '@/providers/org-provider';
import { api, ApiError } from '@/lib/api-client';
import { getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NotificationPanel } from '@/components/notifications/notification-panel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/projects': 'Proyectos',
  '/clients': 'Clientes',
  '/alcances': 'Alcances',
  '/calendar': 'Calendario',
  '/reports': 'Reportes',
  '/team': 'Equipo',
  '/settings': 'Configuración',
  '/profile': 'Mi Perfil',
};

function getPageTitle(pathname: string): string {
  if (pathname === '/' || pathname === '/dashboard') return 'Dashboard';
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(path)) return title;
  }
  return 'Dashboard';
}

interface TopbarProps {
  onMenuToggle?: () => void;
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { organization, organizations, switchOrg, orgId } = useOrg();
  const { unreadCount, setUnreadCount } = useNotificationStore();
  const { theme, setTheme } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showJoinOrg, setShowJoinOrg] = useState(false);
  const [createOrgName, setCreateOrgName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);

  const prevUnreadRef = useRef<number>(0);

  const isDashboard = pathname === '/' || pathname === '/dashboard';
  const isProjectsPage = pathname.startsWith('/projects');

  // Extract current project ID from URL if on a project-specific page
  const projectIdMatch = pathname.match(/^\/projects\/([^/]+)/);
  const currentProjectId = projectIdMatch ? projectIdMatch[1] : null;

  // Load projects for the project switcher
  useEffect(() => {
    if (isProjectsPage && orgId) {
      api.get<any>(`/organizations/${orgId}/projects?limit=50`)
        .then((res) => {
          const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
          setProjects(list);
        })
        .catch(() => {});
    }
  }, [isProjectsPage, orgId]);

  useEffect(() => {
    const loadUnread = async () => {
      try {
        const res = await api.get<any>('/notifications/unread-count');
        const count = typeof res.data === 'number' ? res.data : res.data?.count ?? 0;
        const prevCount = prevUnreadRef.current;

        if (count > prevCount && prevCount > 0) {
          try {
            const notifRes = await api.get<any>('/notifications?limit=1');
            const latest = notifRes.data?.data?.[0];
            if (latest) {
              toast.notification(
                latest.title || 'Nueva notificación',
                latest.message || latest.body || '',
                latest.type,
              );
            }
          } catch {}
        }

        prevUnreadRef.current = count;
        setUnreadCount(count);
      } catch {}
    };
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, [setUnreadCount]);

  const handleCreateOrg = async () => {
    if (!createOrgName.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/organizations', { name: createOrgName.trim() });
      toast.success('Organización creada', 'Tu nueva organización está lista');
      setShowCreateOrg(false);
      setCreateOrgName('');
      window.location.reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al crear la organización';
      toast.error('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinOrg = async () => {
    if (!joinCode.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/organizations/join/${joinCode.trim()}`);
      toast.success('Te has unido', 'Ahora eres miembro de la organización');
      setShowJoinOrg(false);
      setJoinCode('');
      window.location.reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Código de invitación inválido o expirado';
      toast.error('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const currentProject = projects.find((p) => p.id === currentProjectId);

  const pageTitle = getPageTitle(pathname);

  return (
    <>
      <header className="flex h-16 lg:h-20 items-center justify-between border-b border-gray-100 bg-white px-4 md:px-6 lg:px-8 dark:border-gray-800 dark:bg-gray-950">
        {/* Left: Hamburger + Page title + Org switcher */}
        <div className="flex items-center gap-3 lg:gap-6">
          {/* Hamburger menu - mobile only */}
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 lg:hidden dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Menu className="h-6 w-6" />
            </button>
          )}

          <h1 className="text-lg lg:text-2xl font-semibold text-gray-800 dark:text-white">{pageTitle}</h1>

          {/* Org Switcher — only on Dashboard */}
          {isDashboard && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 outline-none dark:border-gray-700 dark:hover:bg-white/5">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="max-w-[80px] md:max-w-[120px] truncate font-medium text-gray-600 dark:text-gray-300">{organization?.name || 'Organización'}</span>
                  <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Organizaciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => switchOrg(org.id)}
                    className="cursor-pointer"
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    <span className="flex-1 truncate">{org.name}</span>
                    {org.id === organization?.id && <Check className="ml-2 h-4 w-4 text-blue-600" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowCreateOrg(true)} className="cursor-pointer">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Organización
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowJoinOrg(true)} className="cursor-pointer">
                  <KeyRound className="mr-2 h-4 w-4" />
                  Unirse con código
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Project Switcher — only on Projects pages */}
          {isProjectsPage && projects.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 outline-none dark:border-gray-700 dark:hover:bg-white/5">
                  <FolderKanban className="h-4 w-4 text-blue-500" />
                  <span className="max-w-[100px] md:max-w-[160px] truncate font-medium text-gray-600 dark:text-gray-300">
                    {currentProject?.name || 'Seleccionar proyecto'}
                  </span>
                  <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel>Cambiar Proyecto</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {projects.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => router.push(`/projects/${project.id}`)}
                    className="cursor-pointer"
                  >
                    <FolderKanban className="mr-2 h-4 w-4 text-gray-400" />
                    <span className="flex-1 truncate">{project.name}</span>
                    {project.id === currentProjectId && <Check className="ml-2 h-4 w-4 text-blue-600" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2 lg:gap-4">
          {/* Search Bar */}
          <div className="relative hidden lg:block">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar tareas, proyectos o miembros..."
              className="w-[300px] rounded-full bg-gray-50 py-3 pl-12 pr-4 text-sm text-gray-600 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-100 dark:bg-gray-900 dark:text-gray-300 dark:placeholder:text-gray-500 dark:focus:ring-blue-900"
            />
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-full bg-gray-50 text-gray-600 transition-colors hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* Settings shortcut - hidden on mobile */}
          <Link
            href="/settings"
            className="hidden md:flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-full bg-gray-50 text-gray-600 transition-colors hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Settings className="h-5 w-5" />
          </Link>

          {/* Notifications */}
          <Popover open={notifOpen} onOpenChange={setNotifOpen}>
            <PopoverTrigger asChild>
              <button className="relative flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-full bg-gray-50 transition-colors hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800">
                <Bell className="h-5 w-5 text-red-400" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex min-w-[20px] h-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 md:w-96 p-0">
              <NotificationPanel open={notifOpen} />
            </PopoverContent>
          </Popover>

          {/* Profile */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-full px-2 py-1 outline-none hover:bg-gray-50 dark:hover:bg-white/5">
                  <Avatar className="h-10 w-10 lg:h-12 lg:w-12">
                    <AvatarImage src={user.image || undefined} />
                    <AvatarFallback className="bg-blue-100 text-sm font-semibold text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                      {getInitials(user.name || '')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left xl:block">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{user.name}</p>
                    <p className="text-xs text-gray-400">{organization?.name || 'Admin'}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Mi Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile/preferences" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Preferencias
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile/security" className="cursor-pointer">
                    <Shield className="mr-2 h-4 w-4" />
                    Seguridad
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Create Organization Dialog */}
      <Dialog open={showCreateOrg} onOpenChange={setShowCreateOrg}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Organización</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre de la organización</Label>
              <Input
                value={createOrgName}
                onChange={(e) => setCreateOrgName(e.target.value)}
                placeholder="Mi Empresa"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateOrg()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateOrg(false)}>Cancelar</Button>
            <Button onClick={handleCreateOrg} disabled={submitting || !createOrgName.trim()}>
              {submitting ? 'Creando...' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Organization Dialog */}
      <Dialog open={showJoinOrg} onOpenChange={setShowJoinOrg}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unirse a una Organización</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Código de invitación</Label>
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Pega el código aquí"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleJoinOrg()}
              />
              <p className="text-xs text-gray-400">Solicita un código de invitación al administrador de la organización.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJoinOrg(false)}>Cancelar</Button>
            <Button onClick={handleJoinOrg} disabled={submitting || !joinCode.trim()}>
              {submitting ? 'Uniéndose...' : 'Unirse'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
