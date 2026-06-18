'use client';

import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SameTopicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
}

/**
 * Modal de eleccion que aparece tras "Crear nueva consulta" en un ticket
 * RESOLVED. Pregunta si la nueva consulta es sobre el mismo tema:
 *  - Si  -> form de nuevo ticket pre-llenado (title+description) + relatedTicketId
 *  - No  -> form vacio, pero relatedTicketId igual (trazabilidad siempre).
 * Navega al listado de tickets con los query params que consume el form de creacion.
 */
export function SameTopicDialog({ open, onOpenChange, ticketId }: SameTopicDialogProps) {
  const router = useRouter();

  const handleChoice = (same: boolean) => {
    onOpenChange(false);
    router.push(`/portal/tickets?related=${ticketId}&same=${same ? '1' : '0'}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear nueva consulta</DialogTitle>
          <DialogDescription>¿Es sobre el mismo tema?</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleChoice(false)}>
            No
          </Button>
          <Button onClick={() => handleChoice(true)}>
            Sí
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
