const TONE_STYLES = {
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
};

export default function InlineAlert({ tone = 'info', title, children, className = '' }) {
  const classes = TONE_STYLES[tone] || TONE_STYLES.info;

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${classes} ${className}`.trim()}>
      {title ? <div className="font-semibold">{title}</div> : null}
      <div>{children}</div>
    </div>
  );
}
