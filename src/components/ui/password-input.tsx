'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input, type InputProps } from './input';

export type PasswordInputProps = Omit<InputProps, 'type'>;

/**
 * Input de contraseña basado en el Input de shadcn con toggle mostrar/ocultar.
 * Usar en formularios que ya usan `<Input>` de shadcn.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-10', className)}
          {...props}
        />
        <PasswordToggle
          visible={visible}
          onToggle={() => setVisible((v) => !v)}
        />
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * Solo el boton flotante de mostrar/ocultar. Usar cuando ya tenes un <input>
 * nativo con estilos custom y solo queres agregar el ojito.
 * Requiere que el contenedor padre sea `position: relative` y el input tenga `pr-10`.
 */
function PasswordToggle({ visible, onToggle, className }: PasswordToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      className={cn(
        'absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground transition-colors',
        className,
      )}
    >
      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

export { PasswordInput, PasswordToggle };
