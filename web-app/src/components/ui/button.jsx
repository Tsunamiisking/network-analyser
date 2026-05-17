import { cn } from '../../lib/utils';

export function Button({ variant = 'default', size = 'default', className, ...props }) {
  const base = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer';
  const variants = {
    default:  'bg-blue-600 text-white hover:bg-blue-700',
    outline:  'border border-border bg-transparent hover:bg-gray-50 text-foreground',
    ghost:    'bg-transparent hover:bg-gray-100 text-foreground',
    secondary:'bg-gray-100 text-gray-900 hover:bg-gray-200',
  };
  const sizes = {
    default: 'h-9 px-4 py-2 text-sm',
    sm:      'h-7 px-3 text-xs',
    lg:      'h-11 px-8 text-base',
    icon:    'h-9 w-9',
  };
  return (
    <button
      className={cn(base, variants[variant] ?? variants.default, sizes[size] ?? sizes.default, className)}
      {...props}
    />
  );
}
