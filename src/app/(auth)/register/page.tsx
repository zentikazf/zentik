'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { registerSchema, type RegisterInput } from '@/lib/validations';
import { api, ApiError } from '@/lib/api-client';
import { PasswordToggle } from '@/components/ui/password-input';

export default function RegisterPage() {
 const router = useRouter();
 const [formData, setFormData] = useState<RegisterInput>({ name: '', email: '', password: '' });
 const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({});
 const [generalError, setGeneralError] = useState('');
 const [isLoading, setIsLoading] = useState(false);
 const [showPassword, setShowPassword] = useState(false);

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
 `mt-1.5 block w-full rounded-xl border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
 fieldErrors[field]
 ? 'border-destructive/30 bg-destructive/10 focus:border-destructive focus:ring-destructive/20'
 : 'border-border bg-muted focus:border-ring focus:ring-ring/20'
 }`;

 return (
 <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
 <div className="text-center">
 <h1 className="text-[22px] font-semibold text-foreground">Crear cuenta</h1>
 <p className="mt-2 text-sm text-muted-foreground">
 Comienza a gestionar tus proyectos en minutos
 </p>
 </div>

 {/* OAuth Buttons — deshabilitado temporalmente
 <div className="mt-6 grid grid-cols-2 gap-3">
 <button type="button" className="...">Google</button>
 <button type="button" className="...">GitHub</button>
 </div>
 <div className="relative my-6">
 <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border"/></div>
 <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-3 text-muted-foreground">O regístrate con email</span></div>
 </div>
 */}

 {/* General Error */}
 {generalError && (
 <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
 <p className="text-sm text-destructive">{generalError}</p>
 </div>
 )}

 {/* Register Form */}
 <form onSubmit={handleSubmit} className="space-y-4"noValidate>
 <div>
 <label htmlFor="name"className="block text-sm font-medium text-foreground">
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
 <p className="mt-1 text-xs text-destructive">{fieldErrors.name}</p>
 )}
 </div>
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
 <label htmlFor="password"className="block text-sm font-medium text-foreground">
 Contraseña
 </label>
 <div className="relative">
 <input
 id="password"
 type={showPassword ? 'text' : 'password'}
 value={formData.password}
 onChange={(e) => handleChange('password', e.target.value)}
 placeholder="Mínimo 8 caracteres"
 autoComplete="new-password"
 className={`${inputClass('password')} pr-10`}
 />
 <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
 </div>
 {fieldErrors.password && (
 <p className="mt-1 text-xs text-destructive">{fieldErrors.password}</p>
 )}
 <p className="mt-1.5 text-xs text-muted-foreground">
 Mínimo 8 caracteres, una mayúscula y un número
 </p>
 </div>
 <button
 type="submit"
 disabled={isLoading}
 className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
 >
 {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
 </button>
 </form>

 <p className="mt-4 text-center text-xs text-muted-foreground">
 Al registrarte, aceptas nuestros{' '}
 <Link href="/terms"className="text-primary hover:underline">
 Términos de servicio
 </Link>{' '}
 y{' '}
 <Link href="/privacy"className="text-primary hover:underline">
 Política de privacidad
 </Link>
 .
 </p>

 <p className="mt-4 text-center text-sm text-muted-foreground">
 ¿Ya tienes cuenta?{' '}
 <Link href="/login"className="font-medium text-primary hover:underline">
 Inicia sesión
 </Link>
 </p>
 </div>
 );
}
