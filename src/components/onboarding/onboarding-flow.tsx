'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { useAuth } from '@/hooks/use-auth';
import { Building, Users, Rocket, ArrowRight, Check, Loader2 } from 'lucide-react';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const { orgId } = useOrg();
  const { user } = useAuth();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Dark blurred overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Step indicator */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                s < step
                  ? 'bg-green-500 text-white'
                  : s === step
                    ? 'bg-blue-600 text-white ring-4 ring-blue-600/20'
                    : 'bg-gray-700 text-gray-400'
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 3 && (
              <div className={`h-0.5 w-12 ${s < step ? 'bg-green-500' : 'bg-gray-700'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Modal content */}
      <div className="relative z-10 w-full max-w-md">
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
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-2xl dark:border-gray-800 dark:bg-gray-950">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950">
        <Building className="h-7 w-7 text-blue-600" />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Nombra tu organización
      </h2>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Hola <span className="font-medium text-gray-700 dark:text-gray-300">{userName}</span>,
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
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500"
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving || !name.trim()}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Continuar
            <ArrowRight className="h-4 w-4" />
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
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-2xl dark:border-gray-800 dark:bg-gray-950">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-950">
        <Users className="h-7 w-7 text-violet-600" />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        ¿Tenés un cliente?
      </h2>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
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
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500"
          autoFocus
        />
        <input
          type="email"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          placeholder="Email del cliente (opcional)"
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500"
        />
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
        >
          Omitir
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !clientName.trim()}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Agregar
              <ArrowRight className="h-4 w-4" />
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
    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-2xl dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950">
        <Rocket className="h-7 w-7 text-emerald-600" />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        ¡Todo listo, {userName}!
      </h2>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Tu espacio de trabajo está configurado. Ahora podés crear proyectos,
        invitar a tu equipo y empezar a gestionar.
      </p>

      <div className="mt-6 space-y-3 text-left">
        <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-900">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
            <Building className="h-4 w-4 text-blue-600" />
          </div>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Crear tu primer <span className="font-medium">proyecto</span>
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-900">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950">
            <Users className="h-4 w-4 text-violet-600" />
          </div>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Invitar a tu <span className="font-medium">equipo</span>
          </span>
        </div>
      </div>

      <button
        onClick={onFinish}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        Ir al Dashboard
        <Rocket className="h-4 w-4" />
      </button>
    </div>
  );
}
