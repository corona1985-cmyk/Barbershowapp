import React, { useEffect, useState } from 'react';

export type ToastTone = 'info' | 'error' | 'success';

type ToastItem = { id: number; text: string; tone: ToastTone };

let emit: ((item: Omit<ToastItem, 'id'>) => void) | null = null;

export function showToast(text: string, tone: ToastTone = 'info'): void {
  emit?.({ text, tone });
}

export const ToastHost: React.FC = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    emit = (item) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setItems((prev) => [...prev.slice(-4), { ...item, id }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    };
    return () => {
      emit = null;
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="fixed top-4 right-4 z-[80] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)]">
      {items.map((item) => (
        <div
          key={item.id}
          className={`rounded-xl px-4 py-3 text-sm font-medium border ${
            item.tone === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : item.tone === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          {item.text}
        </div>
      ))}
    </div>
  );
};
