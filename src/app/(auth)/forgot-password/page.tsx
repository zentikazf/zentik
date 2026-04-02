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
 <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
 <div className="text-center">
 <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
 <Mail className="h-7 w-7 text-primary"/>
 </div>
 <h1 className="text-[22px] font-semibold text-foreground">Recuperar contraseña</h1>
 <p className="mt-2 text-sm text-muted-foreground">
 Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
 </p>
 </div>

 {isSubmitted ? (
 <div className="mt-6 rounded-xl border border-success/30 bg-success/10 p-5 text-center">
 <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-success"/>
 <p className="text-sm text-success">
 Si existe una cuenta con el email <strong>{email}</strong>, recibirás un enlace para
 restablecer tu contraseña en los próximos minutos.
 </p>
 <Link
 href="/login"
 className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
 >
 <ArrowLeft className="h-3.5 w-3.5"/>
 Volver a iniciar sesión
 </Link>
 </div>
 ) : (
 <>
 {/* General Error */}
 {generalError && (
 <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
 <p className="text-sm text-destructive">{generalError}</p>
 </div>
 )}

 <form onSubmit={handleSubmit} className="mt-6 space-y-4"noValidate>
 <div>
 <label htmlFor="email"className="block text-sm font-medium text-foreground">
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
 className={`mt-1.5 block w-full rounded-xl border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
 fieldError
 ? 'border-destructive/30 bg-destructive/10 focus:border-destructive focus:ring-red-200'
 : 'border-border bg-muted focus:border-primary focus:ring-ring/20'
 }`}
 />
 {fieldError && (
 <p className="mt-1 text-xs text-destructive">{fieldError}</p>
 )}
 </div>
 <button
 type="submit"
 disabled={isLoading}
 className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
 >
 {isLoading ? 'Enviando...' : 'Enviar enlace de recuperación'}
 </button>
 </form>
 </>
 )}

 <p className="mt-6 text-center text-sm text-muted-foreground">
 ¿Recordaste tu contraseña?{' '}
 <Link href="/login"className="font-medium text-primary hover:underline">
 Inicia sesión
 </Link>
 </p>
 </div>
 );
}
