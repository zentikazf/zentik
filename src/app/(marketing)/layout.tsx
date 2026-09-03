import Link from 'next/link';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
 return (
 <div className="min-h-screen flex flex-col">
 <header className="border-b bg-card">
 <nav className="container mx-auto flex h-16 items-center justify-between px-4">
 <Link href="/"className="text-xl font-bold text-primary">Zentik</Link>
 <div className="flex items-center gap-6">
 <Link href="/pricing"className="text-sm text-muted-foreground hover:text-foreground">Precios</Link>
 {/* #68 F5: el CTA pasa a ser el login. El auto-registro salio de la interfaz — ver el
   comentario largo en `(auth)/login/page.tsx`. El endpoint del backend sigue vivo.
   <Link href="/register" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">Empezar gratis</Link> */}
 <Link href="/login"className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">Iniciar sesion</Link>
 </div>
 </nav>
 </header>
 <main className="flex-1">{children}</main>
 <footer className="border-t py-8">
 <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
 &copy; 2026 Zentik. Todos los derechos reservados.
 </div>
 </footer>
 </div>
 );
}
