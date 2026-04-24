'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { loginSchema, type LoginInput } from '@/lib/validations';
import { api, ApiError } from '@/lib/api-client';
import { PasswordToggle } from '@/components/ui/password-input';

export default function LoginPage() {
 const router = useRouter();
 const [formData, setFormData] = useState<LoginInput>({ email: '', password: '' });
 const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginInput, string>>>({});
 const [generalError, setGeneralError] = useState('');
 const [isLoading, setIsLoading] = useState(false);
 const [showPassword, setShowPassword] = useState(false);

 function handleChange(field: keyof LoginInput, value: string) {
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

 const result = loginSchema.safeParse(formData);
 if (!result.success) {
 const errors: Partial<Record<keyof LoginInput, string>> = {};
 result.error.errors.forEach((err) => {
 const field = err.path[0] as keyof LoginInput;
 if (!errors[field]) errors[field] = err.message;
 });
 setFieldErrors(errors);
 return;
 }

 setIsLoading(true);
 try {
 await api.post('/auth/login', result.data);
 router.push('/dashboard');
 } catch (error) {
 if (error instanceof ApiError) {
 if (error.statusCode === 401) {
 setGeneralError('Email o contraseña incorrectos');
 } else if (error.statusCode === 403) {
 setGeneralError('Tu cuenta ha sido desactivada. Contacta al administrador.');
 } else {
 setGeneralError(error.message || 'Error al iniciar sesión. Intenta de nuevo.');
 }
 } else {
 setGeneralError('No se pudo conectar al servidor. Verifica tu conexión.');
 }
 } finally {
 setIsLoading(false);
 }
 }

 const inputClass = (field: keyof LoginInput) =>
 `mt-1.5 block w-full rounded-xl border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
 fieldErrors[field]
 ? 'border-destructive/30 bg-destructive/10 focus:border-destructive focus:ring-destructive/20'
 : 'border-border bg-muted focus:border-ring focus:ring-ring/20'
 }`;

 return (
 <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
 <div className="text-center">
 <h1 className="text-[22px] font-semibold text-foreground">Iniciar sesión</h1>
 <p className="mt-2 text-sm text-muted-foreground">
 Ingresa tus credenciales para acceder a tu cuenta
 </p>
 </div>

 {/* OAuth Buttons — deshabilitado temporalmente
 <div className="mt-6 grid grid-cols-2 gap-3">
 <button type="button" className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
 Google
 </button>
 <button type="button" className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
 GitHub
 </button>
 </div>
 <div className="relative my-6">
 <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border"/></div>
 <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-3 text-muted-foreground">O continúa con email</span></div>
 </div>
 */}

 {/* General Error */}
 {generalError && (
 <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
 <p className="text-sm text-destructive">{generalError}</p>
 </div>
 )}

 {/* Login Form */}
 <form onSubmit={handleSubmit} className="space-y-4"noValidate>
 <div>
 <label htmlFor="email"className="block text-sm font-medium text-foreground">
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
 <p className="mt-1 text-xs text-destructive">{fieldErrors.email}</p>
 )}
 </div>
 <div>
 <div className="flex items-center justify-between">
 <label htmlFor="password"className="block text-sm font-medium text-foreground">
 Contraseña
 </label>
 <Link href="/forgot-password"className="text-xs text-primary hover:underline">
 ¿Olvidaste tu contraseña?
 </Link>
 </div>
 <div className="relative">
 <input
 id="password"
 type={showPassword ? 'text' : 'password'}
 value={formData.password}
 onChange={(e) => handleChange('password', e.target.value)}
 placeholder="••••••••"
 autoComplete="current-password"
 className={`${inputClass('password')} pr-10`}
 />
 <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
 </div>
 {fieldErrors.password && (
 <p className="mt-1 text-xs text-destructive">{fieldErrors.password}</p>
 )}
 </div>
 <button
 type="submit"
 disabled={isLoading}
 className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
 >
 {isLoading ? 'Ingresando...' : 'Iniciar sesión'}
 </button>
 </form>

 <p className="mt-6 text-center text-sm text-muted-foreground">
 ¿No tienes cuenta?{' '}
 <Link href="/register"className="font-medium text-primary hover:underline">
 Regístrate gratis
 </Link>
 </p>
 </div>
 );
}
