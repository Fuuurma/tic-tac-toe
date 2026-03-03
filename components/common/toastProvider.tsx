"use client";

import React, { useEffect, useState } from "react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  duration: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type?: Toast["type"], duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: Toast["type"] = "info", duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setIsVisible(true), 10);
    
    // Start exit animation before removing
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  }, [toast.id, toast.duration, onRemove]);

  const typeStyles = {
    success: "bg-emerald-500/90 border-emerald-400 text-white",
    error: "bg-red-500/90 border-red-400 text-white",
    info: "bg-blue-500/90 border-blue-400 text-white",
    warning: "bg-amber-500/90 border-amber-400 text-white",
  };

  const typeIcons = {
    success: "✓",
    error: "✕",
    info: "ℹ",
    warning: "⚠",
  };

  return (
    <div
      className={`
        pointer-events-auto
        min-w-[280px] max-w-[400px]
        px-4 py-3 rounded-lg shadow-lg
        border backdrop-blur-md
        flex items-center gap-3
        transform transition-all duration-300 ease-out
        ${typeStyles[toast.type]}
        ${isVisible && !isExiting ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
      `}
      role="alert"
    >
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
        {typeIcons[toast.type]}
      </span>
      <p className="text-sm font-medium flex-1">{toast.message}</p>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onRemove(toast.id), 300);
        }}
        className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
        aria-label="Close toast"
      >
        ×
      </button>
    </div>
  );
};

export default ToastProvider;
