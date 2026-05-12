'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordToggle } from '@/components/ui/password-input';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

type CheckState =
  | { status: 'loading' }
  | { status: 'valid' }
  | { status: 'invalid'; reason: string };

const REASON_MSG: Record<string, string> = {
  NOT_FOUND: 'El link de activación no es válido.',
  ALREADY_USED: 'Este link ya fue utilizado. Si necesitás otro, contactá a tu administrador.',
  EXPIRED: 'El link de activación expiró. Pedile a tu administrador que te envíe uno nuevo.',
  MISSING_TOKEN: 'Falta el token de activación.',
};

export default function ActivateAccountPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [check, setCheck] = useState<CheckState>({ status: 'loading' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pwdError, setPwdError] = useState('');

  useEffect(() => {
    if (!token) {
      setCheck({ status: 'invalid', reason: 'MISSING_TOKEN' });
      return;
    }
    api
      .get<{ valid: boolean; reason?: string }>(
        `/auth/activate/check?token=${encodeURIComponent(token)}`,
      )
      .then((res) => {
        if (res.data.valid) setCheck({ status: 'valid' });
        else setCheck({ status: 'invalid', reason: res.data.reason ?? 'NOT_FOUND' });
      })
      .catch(() => setCheck({ status: 'invalid', reason: 'NOT_FOUND' }));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');

    if (password.length < 6) {
      setPwdError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setPwdError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/activate', { token, password });
      toast.success(
        'Cuenta activada',
        'Ya podés iniciar sesión con tu nueva contraseña.',
      );
      router.replace('/login');
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'No se pudo activar la cuenta. Intentá de nuevo.';
      setPwdError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (check.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Verificando link de activación...</span>
        </div>
      </div>
    );
  }

  if (check.status === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-8 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Link no válido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {REASON_MSG[check.reason] ?? REASON_MSG.NOT_FOUND}
          </p>
          <Button className="mt-6 w-full" onClick={() => router.replace('/login')}>
            Ir al login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <KeyRound className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Activá tu cuenta</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Definí una contraseña para empezar a usar la plataforma.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="password" className="text-xs font-medium">
              Nueva contraseña
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="password"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={submitting}
                className="pr-10"
              />
              <PasswordToggle visible={showPwd} onToggle={() => setShowPwd((v) => !v)} />
            </div>
          </div>

          <div>
            <Label htmlFor="confirm" className="text-xs font-medium">
              Repetir contraseña
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="confirm"
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={submitting}
                className="pr-10"
              />
              <PasswordToggle
                visible={showConfirm}
                onToggle={() => setShowConfirm((v) => !v)}
              />
            </div>
          </div>

          {pwdError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{pwdError}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Activando...' : 'Activar cuenta'}
          </Button>
        </form>

        <div className="mt-6 flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
          <span>
            Después de activar tu cuenta vas a poder iniciar sesión con tu email y esta contraseña.
          </span>
        </div>
      </div>
    </div>
  );
}
