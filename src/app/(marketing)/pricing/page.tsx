import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
 title: 'Precios',
};

const plans = [
 {
 name: 'Free',
 price: '$0',
 period: '/mes',
 description: 'Para equipos pequenos que estan comenzando.',
 cta: 'Comenzar gratis',
 href: '/register',
 highlighted: false,
 features: [
 'Hasta 3 proyectos',
 'Hasta 5 miembros',
 'Tablero Kanban basico',
 'Chat por proyecto',
 '1 GB de almacenamiento',
 'Soporte por email',
 ],
 },
 {
 name: 'Pro',
 price: '$19',
 period: '/usuario/mes',
 description: 'Para equipos en crecimiento que necesitan mas poder.',
 cta: 'Iniciar prueba gratuita',
 href: '/register?plan=pro',
 highlighted: true,
 features: [
 'Proyectos ilimitados',
 'Hasta 50 miembros',
 'Tablero Kanban + Sprints',
 'Control de tiempo avanzado',
 'Reportes y analiticas',
 '50 GB de almacenamiento',
 'Roles y permisos personalizados',
 'Integraciones (Slack, GitHub, etc.)',
 'Soporte prioritario',
 ],
 },
 {
 name: 'Enterprise',
 price: 'Personalizado',
 period: '',
 description: 'Para organizaciones grandes con necesidades especificas.',
 cta: 'Contactar ventas',
 href: '/contact',
 highlighted: false,
 features: [
 'Todo en Pro',
 'Miembros ilimitados',
 'SSO / SAML',
 'Audit logs',
 'Almacenamiento ilimitado',
 'SLA garantizado',
 'Onboarding dedicado',
 'API avanzada',
 'Soporte 24/7',
 ],
 },
];

const comparisonFeatures = [
 { name: 'Proyectos', free: 'Hasta 3', pro: 'Ilimitados', enterprise: 'Ilimitados' },
 { name: 'Miembros', free: 'Hasta 5', pro: 'Hasta 50', enterprise: 'Ilimitados' },
 { name: 'Tablero Kanban', free: 'Basico', pro: 'Avanzado', enterprise: 'Avanzado' },
 { name: 'Sprints', free: '---', pro: 'Si', enterprise: 'Si' },
 { name: 'Control de Tiempo', free: 'Basico', pro: 'Avanzado', enterprise: 'Avanzado' },
 { name: 'Chat en tiempo real', free: 'Si', pro: 'Si', enterprise: 'Si' },
 { name: 'Reportes', free: 'Basico', pro: 'Avanzado', enterprise: 'Personalizado' },
 { name: 'Almacenamiento', free: '1 GB', pro: '50 GB', enterprise: 'Ilimitado' },
 { name: 'Roles personalizados', free: '---', pro: 'Si', enterprise: 'Si' },
 { name: 'Integraciones', free: '---', pro: 'Si', enterprise: 'Si' },
 { name: 'SSO / SAML', free: '---', pro: '---', enterprise: 'Si' },
 { name: 'Audit Logs', free: '---', pro: '---', enterprise: 'Si' },
 { name: 'SLA', free: '---', pro: '---', enterprise: 'Si' },
 { name: 'Soporte', free: 'Email', pro: 'Prioritario', enterprise: '24/7 dedicado' },
];

export default function PricingPage() {
 return (
 <div className="py-20">
 <div className="container mx-auto px-4">
 {/* Header */}
 <div className="text-center">
 <h1 className="text-4xl font-bold tracking-tight">
 Planes y Precios
 </h1>
 <p className="mt-4 text-lg text-muted-foreground">
 Elige el plan que mejor se adapte a tu equipo. Cambia o cancela en cualquier momento.
 </p>
 </div>

 {/* Plans Grid */}
 <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
 {plans.map((plan) => (
 <div
 key={plan.name}
 className={`relative rounded-lg border p-8 ${
 plan.highlighted
 ? 'border-primary shadow-lg ring-2 ring-primary'
 : 'shadow-sm'
 }`}
 >
 {plan.highlighted && (
 <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
 Mas popular
 </span>
 )}
 <h3 className="text-lg font-semibold">{plan.name}</h3>
 <div className="mt-4">
 <span className="text-4xl font-bold">{plan.price}</span>
 <span className="text-muted-foreground">{plan.period}</span>
 </div>
 <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
 <Link
 href={plan.href}
 className={`mt-6 block w-full rounded-md px-4 py-2 text-center text-sm font-medium ${
 plan.highlighted
 ? 'bg-primary text-primary-foreground hover:bg-primary/90'
 : 'border bg-card text-foreground hover:bg-muted'
 }`}
 >
 {plan.cta}
 </Link>
 <ul className="mt-8 space-y-3">
 {plan.features.map((feature) => (
 <li key={feature} className="flex items-start gap-2 text-sm">
 <svg
 className="mt-0.5 h-4 w-4 shrink-0 text-primary"
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 strokeWidth={2}
 >
 <path strokeLinecap="round"strokeLinejoin="round"d="M5 13l4 4L19 7"/>
 </svg>
 {feature}
 </li>
 ))}
 </ul>
 </div>
 ))}
 </div>

 {/* Comparison Table */}
 <div className="mt-24">
 <h2 className="text-center text-2xl font-bold">Comparacion detallada</h2>
 <div className="mt-8 overflow-x-auto">
 <table className="w-full border-collapse text-sm">
 <thead>
 <tr className="border-b">
 <th className="py-4 pr-4 text-left font-semibold">Caracteristica</th>
 <th className="px-4 py-4 text-center font-semibold">Free</th>
 <th className="px-4 py-4 text-center font-semibold text-primary">Pro</th>
 <th className="px-4 py-4 text-center font-semibold">Enterprise</th>
 </tr>
 </thead>
 <tbody>
 {comparisonFeatures.map((feature) => (
 <tr key={feature.name} className="border-b">
 <td className="py-3 pr-4 font-medium">{feature.name}</td>
 <td className="px-4 py-3 text-center text-muted-foreground">{feature.free}</td>
 <td className="px-4 py-3 text-center">{feature.pro}</td>
 <td className="px-4 py-3 text-center text-muted-foreground">{feature.enterprise}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 </div>
 );
}
