'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { useAuth } from '@/hooks/use-auth';
import { Building, Users, Rocket, ArrowRight, Check, Loader2 } from 'lucide-react';

interface OnboardingFlowProps {
 onComplete: () => void;
}

const STEPS = [
 { label: 'Organización', icon: Building },
 { label: 'Cliente', icon: Users },
 { label: 'Listo', icon: Rocket },
];

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
 const [step, setStep] = useState(1);
 const { orgId } = useOrg();
 const { user } = useAuth();

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center">
 {/* Dark blurred overlay */}
 <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>

 {/* Step indicator */}
 <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
 {STEPS.map((s, i) => {
 const num = i + 1;
 const Icon = s.icon;
 return (
 <div key={num} className="flex items-center gap-2">
 <div className="flex flex-col items-center gap-1.5">
 <div
 className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
 num < step
 ? 'bg-primary text-primary-foreground shadow-lg shadow-blue-500/30'
 : num === step
 ? 'bg-primary text-primary-foreground ring-4 ring-blue-600/20 shadow-lg shadow-blue-600/30'
 : 'bg-card/10 text-white/40 backdrop-blur-sm'
 }`}
 >
 {num < step ? <Check className="h-4 w-4"/> : <Icon className="h-4 w-4"/>}
 </div>
 <span className={`text-xs font-medium ${
 num <= step ? 'text-white' : 'text-white/40'
 }`}>
 {s.label}
 </span>
 </div>
 {num < 3 && (
 <div className={`mb-5 h-0.5 w-16 rounded-full transition-all ${
 num < step ? 'bg-primary' : 'bg-card/10'
 }`} />
 )}
 </div>
 );
 })}
 </div>

 {/* Modal content */}
 <div className="relative z-10 w-full max-w-md px-4">
 {step === 1 && (
 <StepOrganization
 orgId={orgId!}
 userName={user?.name || ''}
 onNext={() => setStep(2)}
 />
 )}
 {step === 2 && (
 <StepClient
 orgId={orgId!}
 onNext={() => setStep(3)}
 onSkip={() => setStep(3)}
 />
 )}
 {step === 3 && (
 <StepWelcome
 userName={user?.name || ''}
 onFinish={onComplete}
 />
 )}
 </div>
 </div>
 );
}

// ─── Step 1: Organization Name ───────────────────────────────────────────────

function StepOrganization({
 orgId,
 userName,
 onNext,
}: {
 orgId: string;
 userName: string;
 onNext: () => void;
}) {
 const [name, setName] = useState('');
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState('');

 const handleSubmit = async () => {
 const trimmed = name.trim();
 if (!trimmed) {
 setError('El nombre es obligatorio');
 return;
 }
 if (trimmed.length < 2) {
 setError('Mínimo 2 caracteres');
 return;
 }

 setSaving(true);
 setError('');
 try {
 await api.patch(`/organizations/${orgId}`, { name: trimmed });
 onNext();
 } catch {
 setError('Error al guardar. Intenta de nuevo.');
 } finally {
 setSaving(false);
 }
 };

 return (
 <div className="rounded-2xl border border-primary/20 bg-card p-8 shadow-2xl shadow-primary/10">
 <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
 <Building className="h-7 w-7 text-primary"/>
 </div>

 <h2 className="text-2xl font-bold text-foreground">
 Nombra tu organización
 </h2>
 <p className="mt-2 text-sm text-muted-foreground">
 Hola <span className="font-medium text-foreground">{userName}</span>,
 ¿cómo se llama tu empresa o equipo?
 </p>

 <div className="mt-6">
 <input
 type="text"
 value={name}
 onChange={(e) => {
 setName(e.target.value);
 setError('');
 }}
 onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
 placeholder="Ej: Acme Corp, Mi Startup, Equipo Dev..."
 className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20"
 autoFocus
 />
 {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
 </div>

 <button
 onClick={handleSubmit}
 disabled={saving || !name.trim()}
 className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
 >
 {saving ? (
 <Loader2 className="h-4 w-4 animate-spin"/>
 ) : (
 <>
 Continuar
 <ArrowRight className="h-4 w-4"/>
 </>
 )}
 </button>
 </div>
 );
}

// ─── Step 2: First Client (Optional) ────────────────────────────────────────

function StepClient({
 orgId,
 onNext,
 onSkip,
}: {
 orgId: string;
 onNext: () => void;
 onSkip: () => void;
}) {
 const [clientName, setClientName] = useState('');
 const [clientEmail, setClientEmail] = useState('');
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState('');

 const handleSubmit = async () => {
 const trimmedName = clientName.trim();
 if (!trimmedName) {
 setError('El nombre del cliente es obligatorio');
 return;
 }

 setSaving(true);
 setError('');
 try {
 await api.post(`/organizations/${orgId}/clients`, {
 name: trimmedName,
 email: clientEmail.trim() || undefined,
 });
 onNext();
 } catch {
 setError('Error al crear cliente. Intenta de nuevo.');
 } finally {
 setSaving(false);
 }
 };

 return (
 <div className="rounded-2xl border border-primary/20 bg-card p-8 shadow-2xl shadow-primary/10">
 <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
 <Users className="h-7 w-7 text-primary"/>
 </div>

 <h2 className="text-2xl font-bold text-foreground">
 ¿Tenés un cliente?
 </h2>
 <p className="mt-2 text-sm text-muted-foreground">
 Si ya tenés un cliente, podés agregarlo ahora. Si no, podés omitir este paso.
 </p>

 <div className="mt-6 space-y-3">
 <input
 type="text"
 value={clientName}
 onChange={(e) => {
 setClientName(e.target.value);
 setError('');
 }}
 placeholder="Nombre del cliente o empresa"
 className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20"
 autoFocus
 />
 <input
 type="email"
 value={clientEmail}
 onChange={(e) => setClientEmail(e.target.value)}
 placeholder="Email del cliente (opcional)"
 className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20"
 />
 {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
 </div>

 <div className="mt-6 flex gap-3">
 <button
 onClick={onSkip}
 className="flex-1 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
 >
 Omitir
 </button>
 <button
 onClick={handleSubmit}
 disabled={saving || !clientName.trim()}
 className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
 >
 {saving ? (
 <Loader2 className="h-4 w-4 animate-spin"/>
 ) : (
 <>
 Agregar
 <ArrowRight className="h-4 w-4"/>
 </>
 )}
 </button>
 </div>
 </div>
 );
}

// ─── Step 3: Welcome ─────────────────────────────────────────────────────────

function StepWelcome({
 userName,
 onFinish,
}: {
 userName: string;
 onFinish: () => void;
}) {
 return (
 <div className="rounded-2xl border border-primary/20 bg-card p-8 text-center shadow-2xl shadow-primary/10">
 <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
 <Rocket className="h-7 w-7 text-primary"/>
 </div>

 <h2 className="text-2xl font-bold text-foreground">
 ¡Todo listo, {userName}!
 </h2>
 <p className="mt-2 text-sm text-muted-foreground">
 Tu espacio de trabajo está configurado. Ahora podés crear proyectos,
 invitar a tu equipo y empezar a gestionar.
 </p>

 <div className="mt-6 space-y-3 text-left">
 <div className="flex items-center gap-3 rounded-lg bg-primary/10 px-4 py-3">
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15/50">
 <Building className="h-4 w-4 text-primary"/>
 </div>
 <span className="text-sm text-foreground">
 Crear tu primer <span className="font-medium">proyecto</span>
 </span>
 </div>
 <div className="flex items-center gap-3 rounded-lg bg-primary/10 px-4 py-3">
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15/50">
 <Users className="h-4 w-4 text-primary"/>
 </div>
 <span className="text-sm text-foreground">
 Invitar a tu <span className="font-medium">equipo</span>
 </span>
 </div>
 </div>

 <button
 onClick={onFinish}
 className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
 >
 Ir al Dashboard
 <Rocket className="h-4 w-4"/>
 </button>
 </div>
 );
}
