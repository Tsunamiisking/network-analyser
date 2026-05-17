import { cn } from '../../lib/utils';

const variantStyles = {
  default:     'bg-primary text-primary-foreground',
  secondary:   'bg-secondary text-secondary-foreground',
  outline:     'border border-border bg-transparent text-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
  success:     'bg-green-100 text-green-800',
  warning:     'bg-yellow-100 text-yellow-800',
  info:        'bg-blue-100 text-blue-800',
};

export function Badge({ variant = 'default', className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variantStyles[variant] ?? variantStyles.default,
        className,
      )}
      {...props}
    />
  );
}
