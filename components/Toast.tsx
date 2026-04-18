'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';

export default function Toast() {
  const { lastDeleted, undoDelete, clearUndo } = useStore();
  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    if (!lastDeleted) {
      setTimeLeft(10);
      return;
    }

    setTimeLeft(10);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lastDeleted]);

  if (!lastDeleted) return null;

  const typeLabels: Record<string, string> = {
    phase: 'Journey Phase',
    demandSpace: 'Demand Space',
    category: 'Category',
    circumstance: 'Circumstance',
  };
  const itemType = typeLabels[lastDeleted.type] || 'Item';
  const itemName =
    'label' in lastDeleted.item ? lastDeleted.item.label : 'Unnamed item';

  return (
    <div className="fixed bottom-6 right-6 bg-[#1f1f1f] border border-[#434656]/30 rounded-xl shadow-2xl shadow-black/50 p-4 flex items-center gap-4 z-50">
      <div className="text-sm text-[#c4c5d9]">
        <span className="font-medium text-[#e2e2e2]">{itemType}</span> &quot;{itemName}&quot; deleted
      </div>
      <button
        onClick={undoDelete}
        className="px-4 py-2 bg-[#2e5bff] hover:brightness-110 text-white text-sm font-medium rounded-lg transition-all"
      >
        Undo ({timeLeft}s)
      </button>
      <button
        onClick={clearUndo}
        className="p-1.5 text-[#c4c5d9]/40 hover:text-[#e2e2e2] transition-colors rounded-lg hover:bg-[#2a2a2a]"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
  );
}
