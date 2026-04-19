const TONE_STYLES = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-rose-200 bg-rose-50 text-rose-900',
};

export default function InlineAlert({ tone = 'info', title, children, className = '' }) {
  const classes = TONE_STYLES[tone] || TONE_STYLES.info;

  return (
    <div
      className={[
        'rounded-xl border px-4 py-3 text-sm shadow-sm',
        classes,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {title ? <div className="mb-1 text-sm font-semibold">{title}</div> : null}
      <div className="leading-6">{children}</div>
    </div>
  );
}
