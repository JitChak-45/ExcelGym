import React from 'react';

interface CreditFooterProps {
  className?: string;
}

export const CreditFooter: React.FC<CreditFooterProps> = ({ className = '' }) => {
  return (
    <footer
      className={`w-full py-4 px-6 border-t border-slate-200/80 bg-white/70 text-center text-xs text-slate-500 ${className}`}
    >
      <p className="inline-flex items-center justify-center gap-1.5">
        <span>Designed and Developed by</span>
        <span className="font-semibold text-slate-800">Jit</span>
        <span>with</span>
        <span
          className="animate-heartbeat text-sm leading-none select-none"
          role="img"
          aria-label="love"
        >
          ❤️
        </span>
      </p>
    </footer>
  );
};
