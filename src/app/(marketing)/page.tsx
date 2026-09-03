import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
 title: 'Zentik — Gestiona toda tu SaaS Factory desde un solo lugar',
};

const features = [
 {
 title: 'Gestion de Proyectos',
 description: 'Tableros Kanban, backlogs, sprints y seguimiento de tareas para mantener tus proyectos organizados.',
 icon: '📋',
 },
 {
 title: 'Gestion de Equipos',
 description: 'Administra roles, permisos y asignaciones de tu equipo de forma centralizada.',
 icon: '👥',
 },
 {
 title: 'Control de Tiempo',
 description: 'Registra horas, genera reportes de productividad y optimiza la asignacion de recursos.',
 icon: '⏱️',
 },
 {
 title: 'Facturacion',
 description: 'Gestiona suscripciones, pagos y facturacion directamente desde la plataforma.',
 icon: '💳',
 },
 {
 title: 'Chat en Tiempo Real',
 description: 'Comunicacion instantanea por proyecto con canales, hilos y notificaciones.',
 icon: '💬',
 },
 {
 title: 'Reportes y Analiticas',
 description: 'Dashboards interactivos con metricas clave para tomar decisiones informadas.',
 icon: '📊',
 },
];

export default function LandingPage() {
 return (
 <div>
 {/* Hero Section */}
 <section className="py-20 md:py-32">
 <div className="container mx-auto px-4 text-center">
 <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
 Gestiona toda tu{' '}
 <span className="text-primary">SaaS Factory</span>
 <br />
 desde un solo lugar
 </h1>
 <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
 Proyectos, equipos, tiempo, facturacion y comunicacion unificados en una sola
 plataforma. Todo lo que necesitas para escalar tu operacion SaaS.
 </p>
 <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
 {/* #68 F5: el auto-registro salio de la interfaz, el CTA lleva al login.
   Ver el comentario largo en `(auth)/login/page.tsx`. href original: "/register" */}
 <Link
 href="/login"
 className="rounded-md bg-primary px-8 py-3 text-base font-medium text-primary-foreground shadow hover:bg-primary/90"
 >
 Iniciar sesion
 </Link>
 <Link
 href="/pricing"
 className="rounded-md border px-8 py-3 text-base font-medium text-foreground hover:bg-muted"
 >
 Ver precios
 </Link>
 </div>
 </div>
 </section>

 {/* Features Grid */}
 <section className="border-t bg-muted/40 py-20">
 <div className="container mx-auto px-4">
 <div className="text-center">
 <h2 className="text-3xl font-bold tracking-tight">
 Todo lo que necesitas, integrado
 </h2>
 <p className="mt-4 text-lg text-muted-foreground">
 Deja de saltar entre herramientas. Zentik centraliza tu operacion completa.
 </p>
 </div>
 <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
 {features.map((feature) => (
 <div
 key={feature.title}
 className="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
 >
 <div className="text-3xl">{feature.icon}</div>
 <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
 <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* CTA Section */}
 <section className="py-20">
 <div className="container mx-auto px-4 text-center">
 <h2 className="text-3xl font-bold tracking-tight">
 Listo para transformar tu operacion?
 </h2>
 <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
 Unete a equipos que ya gestionan sus proyectos SaaS de forma mas eficiente con Zentik.
 </p>
 {/* #68 F5: idem el CTA del hero. href original: "/register", texto original:
   "Empezar gratis — sin tarjeta de credito" (prometia un alta que ya no existe). */}
 <Link
 href="/login"
 className="mt-8 inline-block rounded-md bg-primary px-8 py-3 text-base font-medium text-primary-foreground shadow hover:bg-primary/90"
 >
 Iniciar sesion
 </Link>
 </div>
 </section>
 </div>
 );
}
