import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const base = 'w-full rounded-2xl border border-line bg-surface-2 px-4 text-[15px] text-fg placeholder:text-faint outline-none transition focus:border-accent';

export function Label({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm text-muted">
      <span>{children}</span>
      {hint ? <span className="text-xs text-faint">{hint}</span> : null}
    </label>
  );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${base} h-12 ${className}`} />;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={`${base} min-h-24 py-3 ${className}`} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...rest} className={`${base} h-12 ${className}`}>{children}</select>;
}

export function ErrorText({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="mt-1.5 text-sm text-danger">{children}</p>;
}
