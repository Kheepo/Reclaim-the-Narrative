import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastItem: React.FC<{
  toast: Toast;
  onRemove: (id: string) => void;
}> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        handleRemove();
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration]);

  const handleRemove = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300);
  }, [toast.id, onRemove]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-success-500" />;
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-error-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-warning-500" />;
      case 'info':
        return <InformationCircleIcon className="h-5 w-5 text-primary-500" />;
    }
  };

  const getColorClasses = () => {
    switch (toast.type) {
      case 'success':
        return 'border-success-200 bg-success-50 dark:bg-success-950/50 dark:border-success-800';
      case 'error':
        return 'border-error-200 bg-error-50 dark:bg-error-950/50 dark:border-error-800';
      case 'warning':
        return 'border-warning-200 bg-warning-50 dark:bg-warning-950/50 dark:border-warning-800';
      case 'info':
        return 'border-primary-200 bg-primary-50 dark:bg-primary-950/50 dark:border-primary-800';
    }
  };

  return (
    <div
      className={`
        transform transition-all duration-300 ease-out
        ${
          isVisible && !isLeaving
            ? 'translate-x-0 opacity-100 scale-100'
            : 'translate-x-full opacity-0 scale-95'
        }
      `}
    >
      <div
        className={`
          max-w-sm w-full bg-white dark:bg-neutral-800 shadow-lg rounded-lg border
          ${getColorClasses()}
          pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden
        `}
      >
        <div className="p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {getIcon()}
            </div>
            <div className="ml-3 w-0 flex-1">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {toast.title}
              </p>
              {toast.message && (
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {toast.message}
                </p>
              )}
              {toast.action && (
                <div className="mt-3">
                  <button
                    onClick={toast.action.onClick}
                    className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 transition-colors duration-fast"
                  >
                    {toast.action.label}
                  </button>
                </div>
              )}
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button
                onClick={handleRemove}
                className="bg-white dark:bg-neutral-800 rounded-md inline-flex text-neutral-400 hover:text-neutral-500 dark:hover:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-fast"
              >
                <span className="sr-only">Close</span>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: string) => void }> = ({
  toasts,
  onRemove,
}) => {
  return (
    <div
      aria-live="assertive"
      className="fixed inset-0 flex items-end justify-center px-4 py-6 pointer-events-none sm:p-6 sm:items-start sm:justify-end z-toast"
    >
      <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toastData: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const toast: Toast = {
      id,
      duration: 5000, // Default 5 seconds
      ...toastData,
    };
    setToasts((prev) => [...prev, toast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

// Convenience hooks for different toast types
export const useToastHelpers = () => {
  const { addToast } = useToast();

  return {
    success: (title: string, message?: string, action?: Toast['action']) =>
      addToast({ type: 'success', title, message, action }),
    error: (title: string, message?: string, action?: Toast['action']) =>
      addToast({ type: 'error', title, message, action }),
    warning: (title: string, message?: string, action?: Toast['action']) =>
      addToast({ type: 'warning', title, message, action }),
    info: (title: string, message?: string, action?: Toast['action']) =>
      addToast({ type: 'info', title, message, action }),
  };
};