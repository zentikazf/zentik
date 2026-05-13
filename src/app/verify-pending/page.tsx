'use client';

import { useState } from 'react';
import { MailCheck, RefreshCcw, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

export default function VerifyPendingPage() {
  const { user, loading, logout } = useAuth();
  const [resending, setResending] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      await api.post('/auth/resend-verification');
      toast.success(
        'Email reenviado',
        'Revisá tu bandeja de entrada en unos segundos.',
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo reenviar el email.';
      toast.error('Error', msg);
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-warning/30 bg-card p-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-warning/10">
          <MailCheck className="h-7 w-7 text-warning" />
        </div>

        <h1 className="text-center text-[22px] font-semibold text-foreground">
          Verificá tu correo
        </h1>

        <p className="mt-2 text-center text-sm text-muted-foreground">
          Te enviamos un email a{' '}
          <strong className="text-foreground">{user?.email ?? 'tu correo'}</strong> con un link para
          activar tu cuenta.
        </p>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          Hacé clic en el link del correo para empezar a usar Zentikk. Si no lo encontrás,
          revisá la carpeta de spam o promociones.
        </p>

        <div className="mt-6 space-y-2">
          <Button
            type="button"
            onClick={handleResend}
            disabled={resending || loggingOut}
            className="w-full"
          >
            <RefreshCcw className={`mr-2 h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
            {resending ? 'Reenviando...' : 'Reenviar email de verificación'}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            disabled={resending || loggingOut}
            className="w-full"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {loggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
          </Button>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Una vez que verifiques tu correo, podés volver a iniciar sesión y acceder a toda
          la plataforma.
        </p>
      </div>
    </div>
  );
}
