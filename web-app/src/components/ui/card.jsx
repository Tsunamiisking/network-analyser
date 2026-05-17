import { cn } from '../../lib/utils';

export function Card({ className, ...props }) {
  return (
    <div
      className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}
      style={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return (
    <h3
      className={cn('text-sm font-medium leading-none tracking-tight', className)}
      style={{ color: 'hsl(var(--muted-foreground))' }}
      {...props}
    />
  );
}

export function CardValue({ className, ...props }) {
  return (
    <div
      className={cn('text-2xl font-bold', className)}
      style={{ color: 'hsl(var(--foreground))' }}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}
