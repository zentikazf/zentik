'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api-client';

type Status = 'loading' | 'success' | 'invalid' | 'expired' | 'error';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setErrorMsg('Falta el token de verificación en el link.');
      return;
    }

    let cancelled = false;
    api
      .post('/auth/verify-email', { token })
      .then(() => {
        if (!cancelled) setStatus('success');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.code === 'INVALID_VERIFICATION_TOKEN') {
            setStatus('expired');
            setErrorMsg('El link expiró o ya fue usado.');
          } else {
            setStatus('error');
            setErrorMsg(err.message);
          }
        } else {
          setStatus('error');
          setErrorMsg('No se pudo conectar con el servidor.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Verificando tu correo...</span>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-xl border border-success/30 bg-card p-8 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
            <CheckCircle2 className="h-6 w-6 text-success" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">¡Correo verificado!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu cuenta ya está activa. Ya podés acceder a la plataforma con todas las funcionalidades.
          </p>
          <Button className="mt-6 w-full" onClick={() => router.replace('/dashboard')}>
            Ir al dashboard
          </Button>
        </div>
      </div>
    );
  }

  // expired / invalid / error
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">
          {status === 'expired' ? 'Link expirado' : 'No se pudo verificar'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{errorMsg}</p>

        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => router.replace('/login')} className="w-full">
            Ir al login
          </Button>
          <p className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <MailCheck className="h-3.5 w-3.5" />
            Una vez logueado, podés pedir un nuevo link de verificación desde tu perfil.
          </p>
        </div>
      </div>
    </div>
  );
}
