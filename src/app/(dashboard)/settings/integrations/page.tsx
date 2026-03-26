'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, RefreshCw, Unlink, Calendar } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

const staticIntegrations = [
  { name: 'GitHub', description: 'Enlaza repositorios y rastrea commits', icon: '🐙' },
  { name: 'Slack', description: 'Recibe notificaciones en tu workspace de Slack', icon: '💬' },
  { name: 'Google Drive', description: 'Adjunta archivos desde Google Drive', icon: '📁' },
  { name: 'Figma', description: 'Incrusta diseños de Figma en tareas', icon: '🎨' },
];

export default function IntegrationsPage() {
  const [googleStatus, setGoogleStatus] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    api.get('/calendar/google/status').then((res) => setGoogleStatus(res.data)).catch(() => {});
  }, []);

  const isGoogleConnected = googleStatus?.connected || googleStatus?.isConnected;

  const handleGoogleConnect = async () => {
    try {
      const authCode = prompt('Ingresa el código de autorización de Google Calendar:');
      if (!authCode) return;
      await api.post('/calendar/google/connect', { authCode });
      toast.success('Google Calendar conectado');
      const res = await api.get('/calendar/google/status');
      setGoogleStatus(res.data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al conectar';
      toast.error('Error', message);
    }
  };

  const handleGoogleDisconnect = async () => {
    try {
      await api.delete('/calendar/google/disconnect');
      toast.success('Google Calendar desconectado');
      setGoogleStatus(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al desconectar';
      toast.error('Error', message);
    }
  };

  const handleGoogleSync = async () => {
    setSyncing(true);
    try {
      await api.post('/calendar/google/sync');
      toast.success('Sincronización completada');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al sincronizar';
      toast.error('Error', message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold text-gray-800 dark:text-white">Integraciones</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Conecta tus herramientas favoritas para mejorar tu flujo de trabajo</p>
      </div>

      {/* Google Calendar */}
      <div className="flex items-center gap-4 rounded-[25px] bg-white p-6 dark:bg-gray-900">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
          <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-gray-800 dark:text-white">Google Calendar</h3>
          <p className="text-[13px] text-gray-500 dark:text-gray-400">Sincroniza tareas y sprints con tu Google Calendar</p>
        </div>
        {isGoogleConnected ? (
          <div className="flex items-center gap-2">
            <Badge className="bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400">Conectado</Badge>
            <button
              onClick={handleGoogleSync}
              disabled={syncing}
              className="flex h-9 items-center gap-1.5 rounded-full border border-gray-200 px-3 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Sync
            </button>
            <button
              onClick={handleGoogleDisconnect}
              className="flex h-9 w-9 items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Unlink className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="rounded-full" onClick={handleGoogleConnect}>
            Conectar <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Static integrations */}
      <div className="space-y-4">
        {staticIntegrations.map((integration) => (
          <div key={integration.name} className="flex items-center gap-4 rounded-[25px] bg-white p-6 dark:bg-gray-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-2xl dark:bg-gray-800">
              {integration.icon}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold text-gray-800 dark:text-white">{integration.name}</h3>
              <p className="text-[13px] text-gray-500 dark:text-gray-400">{integration.description}</p>
            </div>
            <Badge className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">Próximamente</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
