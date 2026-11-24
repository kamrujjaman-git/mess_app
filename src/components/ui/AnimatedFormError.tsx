interface AnimatedFormErrorProps {
  message: string;
  attempt: number;
  className?: string;
}

export function AnimatedFormError({
  message,
  attempt,
  className = "",
}: AnimatedFormErrorProps) {
  if (!message) return null;

  return (
    <p
      key={attempt}
      role="alert"
      className={`form-error-shake rounded-xl border border-danger-border bg-danger-surface px-3 py-2 text-sm leading-relaxed text-danger-on-surface ${className}`}
    >
      {message}
    </p>
  );
}
