'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  Gauge,
  Layers,
  ListChecks,
  Settings2,
  ShieldCheck,
  Tags,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Tabs por subruta (patrón de `profile/layout.tsx`). Reemplaza el monolito de
// 4 secciones apiladas de `/settings/sla` (#42 Fase 1).
//
// "Categorías internas" va junto a Políticas / Tipos / Criticidades y NO dentro
// de legacy (#42 Fase 2.1): es configuración VIGENTE del modelo nuevo — la
// clasificación que el equipo asigna al tipificar — y escondida en "legacy"
// nadie la encontraba (el selector del diálogo de reclasificación quedaba vacío).
const slaNav = [
  { name: 'Políticas SLA', href: '/settings/sla/politicas', icon: ShieldCheck },
  { name: 'Tipos de solicitud', href: '/settings/sla/tipos', icon: Tags },
  { name: 'Criticidades', href: '/settings/sla/criticidades', icon: Gauge },
  { name: 'Categorías internas', href: '/settings/sla/categorias-internas', icon: Layers },
  { name: 'Cobertura', href: '/settings/sla/cobertura', icon: ListChecks },
  { name: 'Calendario', href: '/settings/sla/calendario', icon: CalendarDays },
  { name: 'Configuración actual (legacy)', href: '/settings/sla/legacy', icon: Settings2 },
];

export default function SlaSettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">SLA y tipos de solicitud</h1>
          <p className="text-sm text-muted-foreground">
            Políticas con nombre, contratos por proyecto, horario hábil y feriados
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {slaNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
