import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
 return (
 <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-4">
 <div className="mb-8 text-center">
 <Link href="/"className="inline-block">
 <span className="block text-2xl font-bold text-primary">Ticketera</span>
 <span className="block text-sm font-medium text-muted-foreground">Onnix</span>
 </Link>
 </div>
 <div className="w-full max-w-md">{children}</div>
 <p className="mt-8 text-center text-xs text-muted-foreground">
 &copy; 2026 Onnix. Todos los derechos reservados.
 </p>
 </div>
 );
}
