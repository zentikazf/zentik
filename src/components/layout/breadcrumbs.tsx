'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const routeNames: Record<string, string> = {
  projects: 'Proyectos',
  calendar: 'Calendario',
  reports: 'Reportes',
  team: 'Equipo',
  settings: 'Configuracion',
  profile: 'Perfil',
  board: 'Tablero',
  backlog: 'Backlog',
  sprints: 'Sprints',
  tasks: 'Tareas',
  time: 'Tiempo',
  chat: 'Chat',
  files: 'Archivos',
  billing: 'Facturacion',
  members: 'Miembros',
  roles: 'Roles',
  integrations: 'Integraciones',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const isLast = index === segments.length - 1;
    const label = routeNames[segment] || segment;

    return { href, label, isLast };
  });

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link href="/" className="hover:text-foreground">
        Inicio
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3" />
          {crumb.isLast ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
