'use client';

import Link from 'next/link';
import { Ticket, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SuggestionsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="rounded-[25px] bg-white p-8 text-center dark:bg-gray-900 max-w-md">
        <Ticket className="mx-auto mb-4 h-12 w-12 text-blue-400" />
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
          Modulo reemplazado
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          El sistema de sugerencias ha sido reemplazado por el sistema de Tickets.
          Los clientes ahora pueden crear tickets directamente desde el portal.
        </p>
        <Link href="/portal/tickets">
          <Button className="mt-6 rounded-full">
            Ir a Tickets <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
