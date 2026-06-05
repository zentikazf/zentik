'use client';

import { useState } from 'react';
import { Bot } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useOrg } from '@/providers/org-provider';
import { cn } from '@/lib/utils';
import { AdminMcpChatModal } from './admin-mcp-chat-modal';

const INTERNAL_ROLES = ['Owner', 'Project Manager', 'Developer'] as const;

/**
 * Boton flotante (FAB) que abre el chat del asistente MCP.
 *
 * Visibilidad (R15):
 * - Solo para roles internos: Owner, Project Manager, Developer.
 * - OCULTO si user.client != null (es un usuario portal de un cliente).
 * - OCULTO mientras se carga la sesion para evitar flash.
 *
 * El modal se monta solo cuando se abre, asi que el costo de tenerlo
 * en el layout es minimo (un boton fijo).
 */
export function AdminMcpFab() {
  const [open, setOpen] = useState(false);
  const { user, loading } = useAuth();
  const { organization } = useOrg();

  // No render durante el loading inicial: evita flash en redirect post-login.
  if (loading || !user) return null;

  // Hard rule: usuarios portal (con client asignado) NO ven el asistente.
  if (user.client) return null;

  // Sin organizacion activa todavia (puede pasar entre auth y org pick).
  if (!organization) return null;

  // Whitelist explicito de roles internos.
  const role = organization.roleName;
  if (!INTERNAL_ROLES.includes(role as (typeof INTERNAL_ROLES)[number])) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Asistente"
        aria-label="Abrir asistente Zentik"
        className={cn(
          'fixed bottom-6 right-6 z-40',
          'flex h-12 w-12 items-center justify-center rounded-full',
          'bg-primary text-primary-foreground shadow-lg',
          'transition-all hover:scale-105 hover:bg-primary/90 hover:shadow-xl',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      >
        <Bot className="h-5 w-5" />
        <span className="sr-only">Asistente</span>
      </button>
      <AdminMcpChatModal open={open} onOpenChange={setOpen} />
    </>
  );
}
