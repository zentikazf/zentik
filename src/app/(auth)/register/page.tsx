'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { registerSchema, type RegisterInput } from '@/lib/validations';
import { api, ApiError } from '@/lib/api-client';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<RegisterInput>({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({});
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  function handleChange(field: keyof RegisterInput, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (generalError) setGeneralError('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError('');

    const result = registerSchema.safeParse(formData);
    if (!result.success) {
      const errors: Partial<Record<keyof RegisterInput, string>> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof RegisterInput;
        if (!errors[field]) errors[field] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/register', result.data);
      router.push('/dashboard');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.statusCode === 409 || error.code === 'USER_ALREADY_EXISTS') {
          setFieldErrors({ email: 'Ya existe una cuenta con este email' });
        } else if (error.statusCode === 400) {
          setGeneralError(error.message || 'Datos inválidos. Revisa los campos e intenta de nuevo.');
        } else {
          setGeneralError(error.message || 'Error al crear la cuenta. Intenta de nuevo.');
        }
      } else {
        setGeneralError('No se pudo conectar al servidor. Verifica tu conexión.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  const inputClass = (field: keyof RegisterInput) =>
    `mt-1.5 block w-full rounded-xl border px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 dark:text-white ${
      fieldErrors[field]
        ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-200 dark:border-red-800 dark:bg-red-950 dark:focus:ring-red-900'
        : 'border-gray-200 bg-gray-50 focus:border-blue-500 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:focus:ring-blue-900'
    }`;

  return (
    <div className="rounded-[25px] bg-white p-8 shadow-sm dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-[22px] font-semibold text-gray-800 dark:text-white">Crear cuenta</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Comienza a gestionar tus proyectos en minutos
        </p>
      </div>

      {/* OAuth Buttons */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Google
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          GitHub
        </button>
      </div>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-200 dark:border-gray-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3 text-gray-400 dark:bg-gray-900">O regístrate con email</span>
        </div>
      </div>

      {/* General Error */}
      {generalError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950">
          <p className="text-sm text-red-700 dark:text-red-400">{generalError}</p>
        </div>
      )}

      {/* Register Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Nombre completo
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Tu nombre"
            autoComplete="name"
            className={inputClass('name')}
          />
          {fieldErrors.name && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.name}</p>
          )}
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
            className={inputClass('email')}
          />
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.email}</p>
          )}
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Contraseña
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
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.password}</p>
          )}
          <p className="mt-1.5 text-xs text-gray-400">
            Mínimo 8 caracteres, una mayúscula y un número
          </p>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-gray-400">
        Al registrarte, aceptas nuestros{' '}
        <Link href="/terms" className="text-blue-600 hover:underline dark:text-blue-400">
          Términos de servicio
        </Link>{' '}
        y{' '}
        <Link href="/privacy" className="text-blue-600 hover:underline dark:text-blue-400">
          Política de privacidad
        </Link>
        .
      </p>

      <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
