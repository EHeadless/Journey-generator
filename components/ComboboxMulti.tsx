'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface SelectionWithPurpose {
  id: string;
  value: string;
  purpose?: string; // Optional: what is this tool used for
}

interface ComboboxMultiProps {
  label: string;
  placeholder?: string;
  options: string[];
  selections: SelectionWithPurpose[];
  onChange: (selections: SelectionWithPurpose[]) => void;
  showPurpose?: boolean; // Whether to show purpose field for each selection
  purposePlaceholder?: string;
}

export default function ComboboxMulti({
  label,
  placeholder = 'Search or type to add...',
  options,
  selections,
  onChange,
  showPurpose = false,
  purposePlaceholder = 'Used for...',
}: ComboboxMultiProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search, excluding already selected
  const selectedValues = selections.map(s => s.value.toLowerCase());
  const filteredOptions = options.filter(
    opt =>
      opt.toLowerCase().includes(search.toLowerCase()) &&
      !selectedValues.includes(opt.toLowerCase())
  );

  // Check if search term is a new custom value
  const isCustomValue =
    search.trim() &&
    !options.some(opt => opt.toLowerCase() === search.trim().toLowerCase()) &&
    !selectedValues.includes(search.trim().toLowerCase());

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addSelection = (value: string) => {
    const newSelection: SelectionWithPurpose = {
      id: crypto.randomUUID(),
      value,
      purpose: '',
    };
    onChange([...selections, newSelection]);
    setSearch('');
    setIsOpen(false);
  };

  const removeSelection = (id: string) => {
    onChange(selections.filter(s => s.id !== id));
  };

  const updatePurpose = (id: string, purpose: string) => {
    onChange(selections.map(s => (s.id === id ? { ...s, purpose } : s)));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && search.trim()) {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        addSelection(filteredOptions[0]);
      } else if (isCustomValue) {
        addSelection(search.trim());
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase mb-2 block" style={{ color: 'var(--fg-3)' }}>{label}</label>

      {/* Selected items */}
      {selections.length > 0 && (
        <div className="space-y-2">
          {selections.map(selection => (
            <div
              key={selection.id}
              className="flex items-center gap-2 rounded-lg p-3"
              style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)' }}
            >
              <span className="text-sm font-medium min-w-[120px]" style={{ color: 'var(--fg-1)' }}>
                {selection.value}
              </span>
              {showPurpose && (
                <input
                  type="text"
                  value={selection.purpose || ''}
                  onChange={e => updatePurpose(selection.id, e.target.value)}
                  placeholder={purposePlaceholder}
                  className="flex-1 bg-transparent border-none text-sm focus:outline-none"
                  style={{ color: 'var(--fg-2)' }}
                />
              )}
              <button
                type="button"
                onClick={() => removeSelection(selection.id)}
                className="p-1 transition-colors"
                style={{ color: 'var(--fg-3)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-3)')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input with dropdown */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full rounded-lg px-4 py-2.5 pr-10 focus:outline-none text-sm"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--fg-1)' }}
          />
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ color: 'var(--fg-3)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Dropdown */}
        {isOpen && (filteredOptions.length > 0 || isCustomValue) && (
          <div
            className="absolute z-50 w-full mt-2 rounded-lg shadow-xl max-h-60 overflow-y-auto"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}
          >
            {filteredOptions.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => addSelection(option)}
                className="w-full px-4 py-2.5 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg"
                style={{ color: 'var(--fg-1)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {option}
              </button>
            ))}
            {isCustomValue && (
              <button
                type="button"
                onClick={() => addSelection(search.trim())}
                className="w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2 font-medium"
                style={{ color: 'var(--accent)', borderTop: '1px solid var(--border-1)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-soft)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add "{search.trim()}"
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
