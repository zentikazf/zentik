'use client';

import { Users, Shield, CreditCard, Puzzle, History, Building2, TicketCheck } from 'lucide-react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/use-permissions';

type SettingsLink = {
  title: string;
  description: string;
  href: string;
  icon: typeof Users;
  ownerOnly?: boolean;
};

const settingsLinks: SettingsLink[] = [
  { title: 'Organizacion', description: 'Datos generales, invitaciones y configuracion', href: '/settings/organization', icon: Building2 },
  { title: 'Miembros', description: 'Gestionar miembros e invitaciones de la organizacion', href: '/settings/members', icon: Users },
  { title: 'Roles y Permisos', description: 'Configurar roles y control de acceso', href: '/settings/roles', icon: Shield },
  { title: 'Facturacion', description: 'Gestionar suscripcion y detalles de facturacion', href: '/settings/billing', icon: CreditCard },
  { title: 'Integraciones', description: 'Conectar servicios de terceros', href: '/settings/integrations', icon: Puzzle },
  { title: 'SLA y Categorías', description: 'Configurar SLA, categorías de ticket y horario hábil', href: '/settings/sla', icon: TicketCheck },
  { title: 'Registro de Actividad', description: 'Historial de acciones de la organizacion', href: '/settings/audit-log', icon: History, ownerOnly: true },
];

export default function SettingsPage() {
  const { isOwner } = usePermissions();

  const visibleLinks = settingsLinks.filter((link) => !link.ownerOnly || isOwner);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuracion</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ajustes de la plataforma</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:shadow-sm group">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
                  <Icon className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground group-hover:text-primary transition-colors">{link.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{link.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
