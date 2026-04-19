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
      <label className="text-xs text-[#c4c5d9]/40">{label}</label>

      {/* Selected items */}
      {selections.length > 0 && (
        <div className="space-y-2">
          {selections.map(selection => (
            <div
              key={selection.id}
              className="flex items-center gap-2 bg-[#252525] border border-[#434656]/30 rounded-lg p-2"
            >
              <span className="text-sm text-[#e2e2e2] font-medium min-w-[120px]">
                {selection.value}
              </span>
              {showPurpose && (
                <input
                  type="text"
                  value={selection.purpose || ''}
                  onChange={e => updatePurpose(selection.id, e.target.value)}
                  placeholder={purposePlaceholder}
                  className="flex-1 bg-transparent border-none text-sm text-[#c4c5d9] placeholder:text-[#c4c5d9]/30 focus:outline-none"
                />
              )}
              <button
                type="button"
                onClick={() => removeSelection(selection.id)}
                className="p-1 text-[#c4c5d9]/40 hover:text-[#ffb4ab] transition-colors"
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
            className="w-full bg-[#1b1b1b] border border-[#434656]/30 rounded-lg px-4 py-2.5 pr-10 focus:ring-2 focus:ring-[#2e5bff] focus:border-transparent focus:outline-none text-sm placeholder:text-[#c4c5d9]/30 text-[#e2e2e2]"
          />
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c4c5d9]/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Dropdown */}
        {isOpen && (filteredOptions.length > 0 || isCustomValue) && (
          <div className="absolute z-50 w-full mt-1 bg-[#1b1b1b] border border-[#434656]/40 rounded-lg shadow-xl max-h-60 overflow-y-auto">
            {filteredOptions.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => addSelection(option)}
                className="w-full px-4 py-2.5 text-left text-sm text-[#e2e2e2] hover:bg-[#2e5bff]/20 transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                {option}
              </button>
            ))}
            {isCustomValue && (
              <button
                type="button"
                onClick={() => addSelection(search.trim())}
                className="w-full px-4 py-2.5 text-left text-sm text-[#b8c3ff] hover:bg-[#2e5bff]/20 transition-colors border-t border-[#434656]/30 flex items-center gap-2"
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
