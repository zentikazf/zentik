'use client';

import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, CheckCircle2, ArrowLeft, AlertCircle } from 'lucide-react';
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/validations';
import { api, ApiError } from '@/lib/api-client';

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [formData, setFormData] = useState<ResetPasswordInput>({ password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ResetPasswordInput, string>>>({});
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  function handleChange(field: keyof ResetPasswordInput, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    if (generalError) setGeneralError('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError('');

    if (!token) {
      setGeneralError('El enlace es inválido o está incompleto.');
      return;
    }

    const result = resetPasswordSchema.safeParse(formData);
    if (!result.success) {
      const errors: Partial<Record<keyof ResetPasswordInput, string>> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof ResetPasswordInput;
        if (!errors[field]) errors[field] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: result.data.password });
      setIsSubmitted(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'INVALID_RESET_TOKEN') {
          setGeneralError('Este enlace es inválido o ya expiró. Solicita uno nuevo.');
        } else {
          setGeneralError(error.message || 'No se pudo restablecer la contraseña. Intenta nuevamente.');
        }
      } else {
        setGeneralError('No se pudo conectar al servidor. Verifica tu conexión.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  const inputClass = (field: keyof ResetPasswordInput) =>
    `mt-1.5 block w-full rounded-xl border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
      fieldErrors[field]
        ? 'border-destructive/30 bg-destructive/10 focus:border-destructive focus:ring-destructive/20'
        : 'border-border bg-muted focus:border-ring focus:ring-ring/20'
    }`;

  if (!token) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-[22px] font-semibold text-foreground">Enlace inválido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este enlace de restablecimiento no es válido o está incompleto.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Solicitar un nuevo enlace
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <KeyRound className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-[22px] font-semibold text-foreground">Nueva contraseña</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Elige una contraseña segura para tu cuenta.
        </p>
      </div>

      {isSubmitted ? (
        <div className="mt-6 rounded-xl border border-success/30 bg-success/10 p-5 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-success" />
          <p className="text-sm text-success font-medium">Contraseña restablecida exitosamente</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Redirigiéndote al inicio de sesión...
          </p>
        </div>
      ) : (
        <>
          {generalError && (
            <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive">{generalError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Nueva contraseña
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                className={inputClass('password')}
              />
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.password}</p>
              )}
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                Confirmar contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                placeholder="Repite la contraseña"
                autoComplete="new-password"
                className={inputClass('confirmPassword')}
              />
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.confirmPassword}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Restableciendo...' : 'Restablecer contraseña'}
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="rounded-xl border border-border bg-card p-8 shadow-sm text-center text-sm text-muted-foreground">Cargando...</div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
