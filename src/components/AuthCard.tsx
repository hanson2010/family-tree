import * as React from 'react';

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

/** Centered card used by the sign-in and sign-in error pages */
export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="tree-canvas flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
        <div className="text-center">
          <span className="font-display mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-brand text-3xl font-semibold text-brand-foreground">
            族
          </span>
          <h1 className="font-display mt-5 text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
