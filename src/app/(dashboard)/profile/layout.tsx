'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Settings, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const profileNav = [
 { name: 'Perfil', href: '/profile', icon: User },
 { name: 'Preferencias', href: '/profile/preferences', icon: Settings },
 { name: 'Seguridad', href: '/profile/security', icon: Shield },
];

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
 const pathname = usePathname();

 return (
 <div className="mx-auto max-w-4xl space-y-6">
 <div>
 <h1 className="text-2xl font-bold">Cuenta</h1>
 <p className="text-muted-foreground">Administra tu perfil, preferencias y seguridad</p>
 </div>

 <div className="flex gap-2 border-b">
 {profileNav.map((item) => {
 const isActive = pathname === item.href;
 return (
 <Link
 key={item.href}
 href={item.href}
 className={cn(
 'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
 isActive
 ? 'border-primary text-primary'
 : 'border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground',
 )}
 >
 <item.icon className="h-4 w-4"/>
 {item.name}
 </Link>
 );
 })}
 </div>

 {children}
 </div>
 );
}
