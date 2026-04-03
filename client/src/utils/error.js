function stringifyBlock(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function getErrorMessage(error, fallback = 'Ocurrió un error inesperado.') {
  if (!error) return fallback;
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error?.error === 'string' && error.error.trim()) {
    return error.error.trim();
  }
  return fallback;
}

export function buildCopyableErrorReport(error, context = 'Error de aplicación') {
  const lines = [context];
  const message = getErrorMessage(error, 'Ocurrió un error inesperado.');

  lines.push(`Mensaje: ${message}`);

  if (error?.status) {
    lines.push(`HTTP Status: ${error.status}`);
  }

  if (error?.requestId) {
    lines.push(`Request ID: ${error.requestId}`);
  }

  if (error?.url) {
    lines.push(`Endpoint: ${error.url}`);
  }

  const detailsBlock = stringifyBlock(error?.details);
  if (detailsBlock) {
    lines.push('');
    lines.push('Details:');
    lines.push(detailsBlock);
  }

  const debugBlock = stringifyBlock(error?.debug);
  if (debugBlock) {
    lines.push('');
    lines.push('Debug:');
    lines.push(debugBlock);
  }

  const rawBlock = stringifyBlock(error?.rawBodySnippet || error?.rawBody);
  if (rawBlock) {
    lines.push('');
    lines.push('Raw Response:');
    lines.push(rawBlock);
  }

  return lines.join('\n');
}

function removeExistingErrorInspector() {
  const existing = document.getElementById('proyectomgm-error-inspector-overlay');
  if (existing) {
    existing.remove();
  }
}

export function showCopyableErrorDialog(error, context = 'Error de aplicación') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const report = buildCopyableErrorReport(error, context);
  removeExistingErrorInspector();

  const overlay = document.createElement('div');
  overlay.id = 'proyectomgm-error-inspector-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(15, 23, 42, 0.65)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '24px';
  overlay.style.zIndex = '99999';

  const panel = document.createElement('div');
  panel.style.width = 'min(900px, 100%)';
  panel.style.maxHeight = '85vh';
  panel.style.overflow = 'hidden';
  panel.style.borderRadius = '18px';
  panel.style.background = '#ffffff';
  panel.style.boxShadow = '0 25px 50px -12px rgba(15, 23, 42, 0.45)';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';

  const header = document.createElement('div');
  header.style.padding = '18px 20px 10px';
  header.style.borderBottom = '1px solid #e2e8f0';

  const title = document.createElement('div');
  title.textContent = 'Detalle del error';
  title.style.fontSize = '18px';
  title.style.fontWeight = '700';
  title.style.color = '#0f172a';

  const subtitle = document.createElement('div');
  subtitle.textContent = 'Copia este bloque y compártelo para revisar exactamente dónde falló.';
  subtitle.style.marginTop = '6px';
  subtitle.style.fontSize = '13px';
  subtitle.style.color = '#475569';

  header.appendChild(title);
  header.appendChild(subtitle);

  const body = document.createElement('div');
  body.style.padding = '16px 20px';
  body.style.overflow = 'auto';

  const textarea = document.createElement('textarea');
  textarea.value = report;
  textarea.readOnly = true;
  textarea.style.width = '100%';
  textarea.style.minHeight = '360px';
  textarea.style.resize = 'vertical';
  textarea.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace';
  textarea.style.fontSize = '12px';
  textarea.style.lineHeight = '1.5';
  textarea.style.border = '1px solid #cbd5e1';
  textarea.style.borderRadius = '12px';
  textarea.style.padding = '12px';
  textarea.style.color = '#0f172a';
  textarea.style.background = '#f8fafc';

  body.appendChild(textarea);

  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.justifyContent = 'space-between';
  footer.style.gap = '12px';
  footer.style.padding = '0 20px 20px';

  const helper = document.createElement('div');
  helper.textContent = 'Consejo: incluye también la hora aproximada en que ocurrió.';
  helper.style.fontSize = '12px';
  helper.style.color = '#64748b';
  helper.style.alignSelf = 'center';

  const buttons = document.createElement('div');
  buttons.style.display = 'flex';
  buttons.style.gap = '10px';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = 'Cerrar';
  closeButton.style.border = '1px solid #cbd5e1';
  closeButton.style.background = '#ffffff';
  closeButton.style.color = '#0f172a';
  closeButton.style.borderRadius = '10px';
  closeButton.style.padding = '10px 14px';
  closeButton.style.cursor = 'pointer';

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.textContent = 'Copiar error';
  copyButton.style.border = '1px solid #1d4ed8';
  copyButton.style.background = '#2563eb';
  copyButton.style.color = '#ffffff';
  copyButton.style.borderRadius = '10px';
  copyButton.style.padding = '10px 14px';
  copyButton.style.cursor = 'pointer';
  copyButton.style.fontWeight = '600';

  async function copyReport() {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(report);
      } else {
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
      }
      copyButton.textContent = 'Copiado';
      window.setTimeout(() => {
        copyButton.textContent = 'Copiar error';
      }, 1500);
    } catch {
      textarea.focus();
      textarea.select();
    }
  }

  function closeDialog() {
    overlay.remove();
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeDialog();
    }
  });

  window.setTimeout(() => {
    textarea.focus();
    textarea.select();
  }, 0);

  copyButton.addEventListener('click', copyReport);
  closeButton.addEventListener('click', closeDialog);
  window.addEventListener(
    'keydown',
    function onEscape(event) {
      if (event.key === 'Escape') {
        closeDialog();
        window.removeEventListener('keydown', onEscape);
      }
    },
    { once: true }
  );

  buttons.appendChild(closeButton);
  buttons.appendChild(copyButton);
  footer.appendChild(helper);
  footer.appendChild(buttons);

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}
