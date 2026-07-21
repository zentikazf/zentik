// Layout pass-through del detalle de cliente (#25 QA/UX — T23).
// Antes tenía un tab bar Resumen/Facturación; se removió: Resumen es la vista
// directa y el acceso a Facturación es una card dentro del Resumen (page.tsx).
// Las páginas hijas ya proveen su propio spacing (space-y-*), por eso el layout
// solo pasa los children.
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
