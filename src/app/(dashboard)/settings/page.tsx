'use client';

import { Users, Shield, CreditCard, Puzzle, History, Building2 } from 'lucide-react';
import Link from 'next/link';

const settingsLinks = [
  { title: 'Organización', description: 'Datos generales, invitaciones y configuración', href: '/settings/organization', icon: Building2 },
  { title: 'Miembros', description: 'Gestionar miembros e invitaciones de la organización', href: '/settings/members', icon: Users },
  { title: 'Roles y Permisos', description: 'Configurar roles y control de acceso', href: '/settings/roles', icon: Shield },
  { title: 'Facturación', description: 'Gestionar suscripción y detalles de facturación', href: '/settings/billing', icon: CreditCard },
  { title: 'Integraciones', description: 'Conectar servicios de terceros', href: '/settings/integrations', icon: Puzzle },
  { title: 'Registro de Actividad', description: 'Historial de acciones de la organización', href: '/settings/audit-log', icon: History },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-gray-800 dark:text-white">Configuración</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Administra tu organización y preferencias</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {settingsLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <div className="flex items-start gap-4 rounded-[25px] bg-white p-6 transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-white/5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
                  <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-gray-800 dark:text-white">{link.title}</h3>
                  <p className="mt-1 text-[13px] text-gray-400">{link.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
