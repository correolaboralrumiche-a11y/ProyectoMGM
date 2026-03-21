import { useEffect, useRef, useState } from 'react';

function formatDateDisplay(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function isPrintableKey(event) {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}

export default function EditableCell({
  value,
  type = 'text',
  onCommit,
  options = [],
  inputRef,
  isActive = false,
  startEditing = false,
  onActivate,
  onNavigate,
  onEditingHandled,
}) {
  const [localValue, setLocalValue] = useState(value ?? '');
  const [isEditing, setIsEditing] = useState(false);
  const innerInputRef = useRef(null);

  useEffect(() => {
    setLocalValue(value ?? '');
  }, [value]);

  useEffect(() => {
    if (!startEditing) return;
    onActivate?.();
    setIsEditing(true);
    onEditingHandled?.();
  }, [onActivate, onEditingHandled, startEditing]);

  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => {
        innerInputRef.current?.focus();
        if (type !== 'select') {
          innerInputRef.current?.select?.();
        }
      });
    }
  }, [isEditing, type]);

  function commit(nextValue = localValue) {
    setIsEditing(false);
    onCommit(nextValue);
  }

  function cancel() {
    setLocalValue(value ?? '');
    setIsEditing(false);
  }

  function handleNavigationKey(event, direction) {
    event.preventDefault();
    event.stopPropagation();
    commit();
    onNavigate?.(direction);
  }

  function renderDisplayValue() {
    if (type === 'date') {
      return formatDateDisplay(localValue) || <span className="text-slate-300">dd/mm/aaaa</span>;
    }

    if (type === 'number') {
      return localValue === '' || localValue === null || typeof localValue === 'undefined'
        ? <span className="text-slate-300">0</span>
        : String(localValue);
    }

    if (type === 'select') {
      return localValue || <span className="text-slate-300">—</span>;
    }

    return localValue || <span className="text-slate-300">&nbsp;</span>;
  }

  if (isEditing) {
    if (type === 'select') {
      return (
        <select
          ref={innerInputRef}
          value={localValue}
          onChange={(event) => {
            const next = event.target.value;
            setLocalValue(next);
            setIsEditing(false);
            onCommit(next);
          }}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              cancel();
            }
            if (event.key === 'Tab') {
              event.preventDefault();
              const direction = event.shiftKey ? 'left' : 'right';
              commit();
              onNavigate?.(direction);
            }
            if (event.key === 'ArrowUp') handleNavigationKey(event, 'up');
            if (event.key === 'ArrowDown') handleNavigationKey(event, 'down');
          }}
          className="h-8 w-full border-none bg-transparent px-2 py-1 text-sm text-slate-800 outline-none"
        >
          {options.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        ref={innerInputRef}
        type={type}
        value={localValue ?? ''}
        onChange={(event) => setLocalValue(event.target.value)}
        onBlur={() => commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') handleNavigationKey(event, 'down');
          if (event.key === 'Tab') {
            event.preventDefault();
            const direction = event.shiftKey ? 'left' : 'right';
            commit();
            onNavigate?.(direction);
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
          if (event.key === 'ArrowUp') handleNavigationKey(event, 'up');
          if (event.key === 'ArrowDown') handleNavigationKey(event, 'down');
          if (event.key === 'ArrowLeft' && event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0) {
            handleNavigationKey(event, 'left');
          }
          if (
            event.key === 'ArrowRight'
            && event.currentTarget.selectionStart === event.currentTarget.value.length
            && event.currentTarget.selectionEnd === event.currentTarget.value.length
          ) {
            handleNavigationKey(event, 'right');
          }
        }}
        className="h-8 w-full border-none bg-transparent px-2 py-1 text-sm text-slate-800 outline-none"
      />
    );
  }

  return (
    <div
      ref={inputRef}
      tabIndex={0}
      onFocus={() => onActivate?.()}
      onClick={() => onActivate?.()}
      onDoubleClick={() => {
        onActivate?.();
        setIsEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === 'F2') {
          event.preventDefault();
          setIsEditing(true);
          return;
        }

        if (event.key === 'Tab') {
          event.preventDefault();
          onNavigate?.(event.shiftKey ? 'left' : 'right');
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          onNavigate?.('up');
          return;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          onNavigate?.('down');
          return;
        }

        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          onNavigate?.('left');
          return;
        }

        if (event.key === 'ArrowRight') {
          event.preventDefault();
          onNavigate?.('right');
          return;
        }

        if (isPrintableKey(event) && type !== 'select') {
          event.preventDefault();
          setLocalValue(event.key);
          setIsEditing(true);
        }
      }}
      className={`min-h-[32px] w-full cursor-default px-2 py-1 text-sm text-slate-800 outline-none ${isActive ? 'bg-sky-50 ring-1 ring-inset ring-sky-400' : 'bg-transparent hover:bg-slate-50'}`}
    >
      {renderDisplayValue()}
    </div>
  );
}
