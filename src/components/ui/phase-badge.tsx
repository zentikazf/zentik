import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const phaseBadgeVariants = cva(
 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
 {
 variants: {
 phase: {
 pendiente: 'bg-phase-pendiente/15 text-phase-pendiente',
 desarrollo: 'bg-phase-desarrollo/15 text-phase-desarrollo',
 testing: 'bg-phase-testing/15 text-phase-testing',
 produccion: 'bg-phase-produccion/15 text-phase-produccion',
 descubrimiento: 'bg-phase-descubrimiento/15 text-phase-descubrimiento',
 planificacion: 'bg-phase-planificacion/15 text-phase-planificacion',
 en_aprobacion: 'bg-phase-en-aprobacion/15 text-phase-en-aprobacion',
 },
 },
 defaultVariants: {
 phase: 'pendiente',
 },
 },
);

const phaseLabels: Record<string, string> = {
 pendiente: 'Pendiente',
 desarrollo: 'Desarrollo',
 testing: 'Testing',
 produccion: 'Produccion',
 descubrimiento: 'Descubrimiento',
 planificacion: 'Planificacion',
 en_aprobacion: 'En aprobacion',
};

// Map Zentik statuses to Onnix phases
const statusToPhase: Record<string, string> = {
 BACKLOG: 'pendiente',
 TODO: 'planificacion',
 IN_PROGRESS: 'desarrollo',
 IN_REVIEW: 'testing',
 DONE: 'produccion',
 DEVELOPMENT: 'desarrollo',
 ON_HOLD: 'pendiente',
 COMPLETED: 'produccion',
 DISCOVERY: 'descubrimiento',
 PLANNING: 'planificacion',
 TESTING: 'testing',
 DEPLOY: 'produccion',
 SUPPORT: 'en_aprobacion',
};

export function mapStatusToPhase(status: string): string {
 return statusToPhase[status] || status.toLowerCase().replace(/ /g, '_');
}

interface PhaseBadgeProps extends Omit<VariantProps<typeof phaseBadgeVariants>, 'phase'> {
 phase: string;
 label?: string;
 className?: string;
}

export function PhaseBadge({ phase, label, className }: PhaseBadgeProps) {
 const normalizedPhase = statusToPhase[phase] || phase;
 const validPhase = (normalizedPhase in phaseLabels ? normalizedPhase : 'pendiente') as NonNullable<
 VariantProps<typeof phaseBadgeVariants>['phase']
 >;

 return (
 <span className={cn(phaseBadgeVariants({ phase: validPhase }), className)}>
 {label || phaseLabels[validPhase] || phase}
 </span>
 );
}
