'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'openai-api-key';

/**
 * Shared hook for the OpenAI API key. The key is stored in localStorage so all
 * pages (Brief, Plan, Capture, Signals, Review, Landscape) see the same value.
 */
export function useApiKey(): [string, (k: string) => void] {
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (apiKey) {
        localStorage.setItem(STORAGE_KEY, apiKey);
      }
    } catch {
      // ignore
    }
  }, [apiKey]);

  return [apiKey, setApiKey];
}
