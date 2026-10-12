import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Address, ContactSuggestion } from '@shared/types';
import { api } from '../api';
import { isValidAddress, parseAddressInput } from '../lib/format';
import { Avatar, cx } from './ui';

export function RecipientField({ label, value, onChange, autoFocus, trailing }: { label: string; value: Address[]; onChange: (v: Address[]) => void; autoFocus?: boolean; trailing?: React.ReactNode }) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([]);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = text.trim();
    if (!q) { setSuggestions([]); return; }
    let alive = true;
    const t = setTimeout(() => {
      api.suggestContacts(q).then((r) => {
        if (!alive) return;
        const have = new Set(value.map((v) => v.address));
        setSuggestions(r.filter((x) => !have.has(x.address)));
        setActive(0);
      }).catch(() => {});
    }, 90);
    return () => { alive = false; clearTimeout(t); };
  }, [text]);

  const commit = (raw: string) => {
    const parts = raw.split(/[,;，；\n]+/).map((p) => p.trim()).filter(Boolean);
    const add: Address[] = [];
    let rest = '';
    for (const p of parts) {
      const a = parseAddressInput(p);
      if (a) add.push(a);
      else rest = p;
    }
    if (add.length) {
      const have = new Set(value.map((v) => v.address));
      onChange([...value, ...add.filter((a) => !have.has(a.address))]);
    }
    setText(rest);
    setSuggestions([]);
  };

  const pick = (sug: ContactSuggestion) => {
    onChange([...value, { name: sug.name, address: sug.address }]);
    setText('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
      return;
    }
    if ((e.key === 'Enter' || e.key === 'Tab') && suggestions.length && text.trim()) {
      e.preventDefault();
      pick(suggestions[active]);
      return;
    }
    if ((e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === '，' || e.key === '；' || (e.key === ' ' && /@.+\./.test(text))) && text.trim()) {
      e.preventDefault();
      commit(text);
      return;
    }
    if (e.key === 'Backspace' && !text && value.length) {
      e.preventDefault();
      const last = value[value.length - 1];
      onChange(value.slice(0, -1));
      setText(last.name ? `${last.name} <${last.address}>` : last.address);
    }
    if (e.key === 'Escape' && suggestions.length) {
      e.stopPropagation();
      setSuggestions([]);
    }
  };

  return (
    <div className={cx('rcpt-field', focused && 'is-focused')} onClick={() => inputRef.current?.focus()}>
      <span className="rcpt-label">{label}</span>
      <div className="rcpt-chips">
        {value.map((a, i) => (
          <span key={a.address + i} className={cx('rcpt-chip', !isValidAddress(a.address) && 'is-invalid')} title={a.address} onDoubleClick={() => { onChange(value.filter((_, j) => j !== i)); setText(a.name ? `${a.name} <${a.address}>` : a.address); inputRef.current?.focus(); }}>
            <Avatar name={a.name} address={a.address} size={18} />
            <span>{a.name || a.address}</span>
            <button tabIndex={-1} aria-label="移除" onClick={(e) => { e.stopPropagation(); onChange(value.filter((_, j) => j !== i)); }}><X size={12} /></button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setTimeout(() => { if (text.trim()) commit(text); setSuggestions([]); }, 150); }}
          onPaste={(e) => {
            const t = e.clipboardData.getData('text');
            if (/[,;，；\n]/.test(t)) { e.preventDefault(); commit(text + t); }
          }}
          spellCheck={false}
          aria-label={label}
        />
      </div>
      {trailing}
      {suggestions.length > 0 && focused && (
        <div className="rcpt-suggest" onMouseDown={(e) => e.preventDefault()}>
          {suggestions.map((sug, i) => (
            <button key={sug.address} className={cx('rcpt-sug', i === active && 'is-active')} onMouseEnter={() => setActive(i)} onClick={() => pick(sug)}>
              <Avatar name={sug.name} address={sug.address} size={26} />
              <span className="rcpt-sug-name">{sug.name || sug.address.split('@')[0]}</span>
              <span className="rcpt-sug-addr">{sug.address}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
