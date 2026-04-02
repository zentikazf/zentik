import type { Metadata } from 'next';
import { ThemeProvider } from '@/providers/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

export const metadata: Metadata = {
 title: {
 default: 'Zentik — Project Management Platform',
 template: '%s | Zentik',
 },
 description:
 'Gestiona toda tu SaaS Factory desde un solo lugar — proyectos, equipos, tiempo, facturacion y comunicacion.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
 return (
 <html lang="es"suppressHydrationWarning>
 <body className="font-sans antialiased">
 <ThemeProvider>
 {children}
 <Toaster />
 </ThemeProvider>
 </body>
 </html>
 );
}
