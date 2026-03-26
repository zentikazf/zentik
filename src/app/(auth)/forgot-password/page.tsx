'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validations';
import { api, ApiError } from '@/lib/api-client';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldError('');
    setGeneralError('');

    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setFieldError(result.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: result.data.email });
      setIsSubmitted(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setGeneralError(error.message || 'Error al enviar el enlace. Intenta de nuevo.');
      } else {
        setGeneralError('No se pudo conectar al servidor. Verifica tu conexión.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-[25px] bg-white p-8 shadow-sm dark:bg-gray-900">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
          <Mail className="h-7 w-7 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-[22px] font-semibold text-gray-800 dark:text-white">Recuperar contraseña</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </div>

      {isSubmitted ? (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5 text-center dark:border-green-800 dark:bg-green-950">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-green-600 dark:text-green-400" />
          <p className="text-sm text-green-800 dark:text-green-300">
            Si existe una cuenta con el email <strong>{email}</strong>, recibirás un enlace para
            restablecer tu contraseña en los próximos minutos.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a iniciar sesión
          </Link>
        </div>
      ) : (
        <>
          {/* General Error */}
          {generalError && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950">
              <p className="text-sm text-red-700 dark:text-red-400">{generalError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldError) setFieldError('');
                  if (generalError) setGeneralError('');
                }}
                placeholder="tu@email.com"
                autoComplete="email"
                className={`mt-1.5 block w-full rounded-xl border px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 dark:text-white ${
                  fieldError
                    ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-200 dark:border-red-800 dark:bg-red-950 dark:focus:ring-red-900'
                    : 'border-gray-200 bg-gray-50 focus:border-blue-500 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:focus:ring-blue-900'
                }`}
              />
              {fieldError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        ¿Recordaste tu contraseña?{' '}
        <Link href="/login" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
