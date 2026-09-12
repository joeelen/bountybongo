import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warn' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warn: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<(Toast & { removing?: boolean })[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350);
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const duration = toast.duration ?? 4000;
    setToasts(prev => [{ ...toast, id, removing: false }, ...prev]);
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const success = useCallback((title: string, message?: string) => addToast({ type: 'success', title, message }), [addToast]);
  const error = useCallback((title: string, message?: string) => addToast({ type: 'error', title, message, duration: 5500 }), [addToast]);
  const warn = useCallback((title: string, message?: string) => addToast({ type: 'warn', title, message, duration: 5000 }), [addToast]);
  const info = useCallback((title: string, message?: string) => addToast({ type: 'info', title, message }), [addToast]);

  const toastConfig: Record<ToastType, { icon: React.ReactNode; border: string; bg: string; iconColor: string; titleColor: string }> = {
    success: {
      icon: <CheckCircle className="w-5 h-5 shrink-0" />,
      border: 'border-cyber-green/60',
      bg: 'bg-cyber-green/10',
      iconColor: 'text-cyber-green',
      titleColor: 'text-cyber-green',
    },
    error: {
      icon: <XCircle className="w-5 h-5 shrink-0" />,
      border: 'border-cyber-red/60',
      bg: 'bg-cyber-red/10',
      iconColor: 'text-cyber-red',
      titleColor: 'text-cyber-red',
    },
    warn: {
      icon: <AlertTriangle className="w-5 h-5 shrink-0" />,
      border: 'border-cyber-yellow/60',
      bg: 'bg-cyber-yellow/10',
      iconColor: 'text-cyber-yellow',
      titleColor: 'text-cyber-yellow',
    },
    info: {
      icon: <Info className="w-5 h-5 shrink-0" />,
      border: 'border-cyber-cyan/60',
      bg: 'bg-cyber-cyan/10',
      iconColor: 'text-cyber-cyan',
      titleColor: 'text-cyber-cyan',
    },
  };

  return (
    <ToastContext.Provider value={{ addToast, success, error, warn, info }}>
      {children}

      {/* Toast container — fixed top-right, above all overlays */}
      <div className="fixed top-20 right-4 z-[99999] flex flex-col gap-2 pointer-events-none w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map(toast => {
          const cfg = toastConfig[toast.type];
          return (
            <div
              key={toast.id}
              className={`
                relative flex items-start gap-3 p-3.5 rounded-lg border backdrop-blur-md
                shadow-lg pointer-events-auto font-rajdhani
                ${cfg.border} ${cfg.bg}
                transition-all duration-300 ease-out
                ${toast.removing
                  ? 'opacity-0 translate-x-8 scale-95'
                  : 'opacity-100 translate-x-0 scale-100'
                }
              `}
              style={{
                background: 'rgba(11, 12, 16, 0.92)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              <span className={cfg.iconColor}>{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <span className={`block text-xs font-black uppercase tracking-wider ${cfg.titleColor}`}>
                  {toast.title}
                </span>
                {toast.message && (
                  <span className="block text-[11px] text-zinc-400 mt-0.5 leading-snug">{toast.message}</span>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0 mt-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
