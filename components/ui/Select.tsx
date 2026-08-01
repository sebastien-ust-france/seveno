'use client';

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type SelectOptionItem = {
  key: string;
  value: string;
  label: ReactNode;
  text: string;
  disabled: boolean;
  isPlaceholder: boolean;
};

type SelectProps = {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  ariaLabel?: string;
  showSelectionSummary?: boolean;
  children?: ReactNode;
};

function toText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => toText(child)).join(' ');
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return toText(node.props.children);
  }

  return '';
}

function isOptionElement(
  node: ReactNode,
): node is ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }> {
  return isValidElement(node) && node.type === 'option';
}

function createSyntheticChangeEvent(value: string): ChangeEvent<HTMLSelectElement> {
  const target = { value } as HTMLSelectElement;
  return {
    target,
    currentTarget: target,
  } as ChangeEvent<HTMLSelectElement>;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function Select({
  value,
  defaultValue = '',
  onChange,
  disabled = false,
  required = false,
  name,
  id,
  className,
  ariaLabel,
  showSelectionSummary = true,
  children,
}: SelectProps) {
  const reactId = useId();
  const selectId = id ?? `select-${reactId}`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [internalValue, setInternalValue] = useState(String(defaultValue));

  const optionItems = useMemo<SelectOptionItem[]>(() => {
    return Children.toArray(children)
      .filter(isOptionElement)
      .map((child, index) => {
        const optionValue = child.props.value === undefined || child.props.value === null ? '' : String(child.props.value);
        const label = child.props.children;
        return {
          key: typeof child.key === 'string' ? child.key : `${optionValue || 'option'}-${index}`,
          value: optionValue,
          label,
          text: toText(label).trim(),
          disabled: Boolean(child.props.disabled),
          isPlaceholder: optionValue.length === 0,
        };
      });
  }, [children]);

  const controlledValue = value === undefined || value === null ? internalValue : String(value);
  const placeholderOption = optionItems.find((option) => option.isPlaceholder);
  const selectedOption = optionItems.find((option) => option.value === controlledValue && !option.isPlaceholder);
  const selectedText = selectedOption?.text ?? '';
  const placeholderText = placeholderOption?.text || 'Sélectionner';

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    return optionItems.filter((option) => {
      if (option.isPlaceholder) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const normalizedLabel = option.text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      return normalizedLabel.includes(normalizedQuery);
    });
  }, [optionItems, query]);

  function closeMenu() {
    setIsOpen(false);
    setQuery('');
  }

  function updatePanelPosition() {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === 'undefined') {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 12;
    const maxHeight = Math.min(window.innerHeight * 0.45, 336);
    const maxWidth = Math.max(window.innerWidth - viewportPadding * 2, 180);
    const width = Math.min(rect.width, maxWidth);
    const left = clamp(rect.left, viewportPadding, window.innerWidth - width - viewportPadding);
    const belowTop = rect.bottom + gap;
    const aboveTop = rect.top - gap - maxHeight;
    const openAbove = belowTop + maxHeight > window.innerHeight - viewportPadding && aboveTop >= viewportPadding;
    const top = openAbove ? aboveTop : belowTop;

    setPanelPosition({
      top,
      left,
      width,
    });
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu();
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePanelPosition();
    const handleResize = () => updatePanelPosition();
    const handleScroll = () => updatePanelPosition();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, query, selectedText]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    searchRef.current?.focus();
  }, [isOpen]);

  function commitValue(nextValue: string) {
    if (value === undefined) {
      setInternalValue(nextValue);
    }

    onChange?.(createSyntheticChangeEvent(nextValue));
    closeMenu();
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
    } else if (event.key === 'Escape') {
      closeMenu();
    }
  }

  const panel =
    isOpen && typeof document !== 'undefined' && panelPosition ? (
      <div
        ref={panelRef}
        className="fixed z-[120] rounded-[22px] border border-white/10 bg-[#050d1f] p-2 shadow-[0_18px_50px_rgba(2,6,23,0.18)]"
        style={{
          top: panelPosition.top,
          left: panelPosition.left,
          width: panelPosition.width,
          maxHeight: '45vh',
        }}
      >
        <div className="space-y-2">
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher"
            className="w-full rounded-[16px] border border-white/10 bg-[#050d1f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
          />

          <div className="max-h-[45vh] space-y-2 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch] sm:max-h-[21rem]">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const active = controlledValue === option.value;

                return (
                  <button
                    key={option.key}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => commitValue(option.value)}
                    className={
                      'flex min-h-11 w-full items-center justify-between gap-3 rounded-[16px] border px-4 py-3 text-left transition duration-200 hover:-translate-y-0.5 touch-manipulation ' +
                      (active
                        ? 'border-blue-400/70 bg-gradient-to-r from-blue-500/20 to-violet-500/20 text-white shadow-[0_16px_40px_rgba(59,130,246,0.14)]'
                        : 'border-white/10 bg-white/5 text-white/90 hover:border-white/20 hover:bg-white/10') +
                      (option.disabled ? ' cursor-not-allowed opacity-40 hover:translate-y-0 hover:shadow-none' : '')
                    }
                  >
                    <span className="block min-w-0 break-words text-sm font-medium leading-6">{option.label}</span>
                    {active ? <span className="text-xs text-white/70">Sélectionné</span> : null}
                  </button>
                );
              })
            ) : (
              <p className="px-4 py-3 text-sm text-slate-400">Aucun résultat ne correspond à votre recherche.</p>
            )}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div ref={rootRef} className="space-y-3">
      {selectedOption && showSelectionSummary ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <span className="max-w-full break-words rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-blue-100">
            Sélectionné : {selectedText}
          </span>
          <button
            type="button"
            onClick={() => commitValue('')}
            className="min-h-11 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white/80 transition hover:border-white/20 hover:bg-white/10 touch-manipulation"
          >
            Effacer
          </button>
        </div>
      ) : null}

      <div className="rounded-[22px] border border-white/10 bg-white/5 shadow-[0_18px_50px_rgba(2,6,23,0.18)]">
        <button
          ref={triggerRef}
          type="button"
          id={selectId}
          disabled={disabled}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          onClick={() => {
            if (!disabled) {
              setIsOpen((previous) => !previous);
            }
          }}
          onKeyDown={handleTriggerKeyDown}
          className={
            'flex min-h-12 w-full items-center justify-between gap-3 px-4 py-4 text-left text-sm text-white transition hover:bg-white/5 touch-manipulation ' +
            (disabled ? 'cursor-not-allowed opacity-60 hover:bg-transparent' : '') +
            (className ? ` ${className}` : '')
          }
        >
          <span className={'min-w-0 flex-1 break-words ' + (selectedText ? 'text-white' : 'text-slate-400')}>
            {selectedText || placeholderText}
          </span>
          <span aria-hidden="true" className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>⌄</span>
          <span className="sr-only">{isOpen ? 'Fermer la liste' : 'Ouvrir la liste'}</span>
        </button>

        {name ? <input type="hidden" name={name} value={controlledValue} readOnly /> : null}
        {required && !controlledValue ? <span className="sr-only">Champ requis.</span> : null}
      </div>

      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
