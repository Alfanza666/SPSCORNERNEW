import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-2xl font-bold transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50',
          {
            'btn-clay-primary': variant === 'default',
            'btn-clay-secondary': variant === 'outline' || variant === 'ghost',
            'btn-clay-danger': variant === 'danger',
            'h-8 px-3 text-[10px]': size === 'sm',
            'h-10 px-4 text-xs': size === 'md',
            'h-12 px-6 text-sm': size === 'lg',
            'h-10 w-10 p-0': size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
