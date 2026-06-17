'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const INTERNAL_ROLES = ['Owner', 'Project Manager', 'Developer'] as const;

interface DrainResult {
  synced: number;
  failed: number;
}

/**
 * Boton "Sincronizar a Onnix" (feature #13).
 *
 * Dispara el drain manual del outbox hacia Onnix (POST /admin/sync/onnix/drain)
 * y muestra los contadores synced/failed en un toast.
 *
 * Visibilidad (R45, R47), molde admin-mcp-fab.tsx:
 * - Solo para roles internos: Owner, Project Manager, Developer.
 * - OCULTO si user.client != null (es un usuario portal de un cliente).
 * - OCULTO mientras se carga la sesion / sin organizacion activa.
 *
 * Ubicacion: toolbar de la vista admin de tickets (no FAB global, para no
 * competir con el FAB del asistente MCP).
 */
export function OnnixSyncButton() {
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { organization } = useOrg();

  // No render durante el loading inicial: evita flash en redirect post-login.
  if (authLoading || !user) return null;

  // Hard rule: usuarios portal (con client asignado) NO ven el boton (R47).
  if (user.client) return null;

  // Sin organizacion activa todavia (puede pasar entre auth y org pick).
  if (!organization) return null;

  // Whitelist explicito de roles internos (R45).
  const role = organization.roleName;
  if (!INTERNAL_ROLES.includes(role as (typeof INTERNAL_ROLES)[number])) {
    return null;
  }

  const handleSync = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Drain manual: mismo metodo processPending() que el cron (R46).
      const res = await api.post<DrainResult>('/admin/sync/onnix/drain');
      const { synced, failed } = res.data;
      if (failed > 0) {
        toast.error(
          'Sincronizacion con errores',
          `${synced} sincronizado(s), ${failed} con error`,
        );
      } else {
        toast.success(
          'Sincronizacion completada',
          `${synced} ticket(s) sincronizado(s) a Onnix`,
        );
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'No se pudo sincronizar con Onnix';
      toast.error('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 gap-1.5 shrink-0"
      onClick={handleSync}
      disabled={loading}
      title="Sincronizar tickets pendientes a Onnix"
    >
      <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
      <span className="hidden sm:inline">
        {loading ? 'Sincronizando...' : 'Sincronizar a Onnix'}
      </span>
    </Button>
  );
}
