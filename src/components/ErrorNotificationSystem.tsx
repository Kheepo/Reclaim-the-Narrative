import React, { useState, useEffect, useCallback } from 'react';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { NetworkError, NetworkErrorType, ErrorSeverity } from '../lib/errors/NetworkErrorHandler';
import {
  AlertTriangle,
  XCircle,
  AlertCircle,
  Info,
  CheckCircle,
  X,
  RefreshCw,
  Clock,
  Wifi,
  WifiOff,
  Zap,
  Shield,
} from 'lucide-react';

interface NotificationProps {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  actions?: NotificationAction[];
  onClose?: () => void;
}

interface NotificationAction {
  label: string;
  action: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

interface ErrorNotificationProps {
  error: NetworkError;
  onRetry?: () => Promise<void>;
  onDismiss?: () => void;
  showDetails?: boolean;
}

interface NotificationSystemProps {
  maxNotifications?: number;
  defaultDuration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  className?: string;
}

// Individual notification component
const Notification: React.FC<NotificationProps> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  persistent = false,
  actions = [],
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!persistent && duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, persistent]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300);
  };

  const handleAction = async (action: NotificationAction, index: number) => {
    const actionKey = `action-${index}`;
    setActionLoading(prev => ({ ...prev, [actionKey]: true }));
    
    try {
      await action.action();
    } catch (error) {
      console.error('Notification action failed:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-orange-50 border-orange-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      case 'success':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getActionButtonClass = (variant: string = 'primary') => {
    const base = 'px-3 py-1 text-sm rounded transition-colors';
    switch (variant) {
      case 'primary':
        return `${base} bg-blue-500 text-gray-900 hover:bg-blue-600`;
      case 'secondary':
        return `${base} bg-gray-500 text-gray-900 hover:bg-gray-600`;
      case 'danger':
        return `${base} bg-red-500 text-gray-900 hover:bg-red-600`;
      default:
        return `${base} bg-gray-200 text-gray-800 hover:bg-gray-300`;
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={`
        transform transition-all duration-300 ease-in-out
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
        max-w-sm w-full bg-white border rounded-lg shadow-lg p-4 mb-3
        ${getBackgroundColor()}
      `}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 flex-1">
          <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
          <p className="text-sm text-gray-700 mt-1">{message}</p>
          
          {actions.length > 0 && (
            <div className="flex space-x-2 mt-3">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleAction(action, index)}
                  disabled={actionLoading[`action-${index}`]}
                  className={`${getActionButtonClass(action.variant)} disabled:opacity-50`}
                >
                  {actionLoading[`action-${index}`] ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    action.label
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Error-specific notification component
const ErrorNotification: React.FC<ErrorNotificationProps> = ({
  error,
  onRetry,
  onDismiss,
  showDetails = false,
}) => {
  const [showFullDetails, setShowFullDetails] = useState(false);

  const getErrorIcon = () => {
    switch (error.type) {
      case NetworkErrorType.CONNECTION_FAILED:
        return <WifiOff className="w-5 h-5 text-red-500" />;
      case NetworkErrorType.RATE_LIMITED:
        return <Zap className="w-5 h-5 text-orange-500" />;
      case NetworkErrorType.TRANSACTION_FAILED:
        return <XCircle className="w-5 h-5 text-red-500" />;
      case NetworkErrorType.CONTRACT_ERROR:
        return <Shield className="w-5 h-5 text-red-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
    }
  };

  const getSeverityColor = () => {
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        return 'bg-red-50 border-red-200';
      case ErrorSeverity.HIGH:
        return 'bg-orange-50 border-orange-200';
      case ErrorSeverity.MEDIUM:
        return 'bg-yellow-50 border-yellow-200';
      case ErrorSeverity.LOW:
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const actions: NotificationAction[] = [];
  
  if (error.recoverable && onRetry) {
    actions.push({
      label: 'Retry',
      action: onRetry,
      variant: 'primary',
    });
  }
  
  if (showDetails) {
    actions.push({
      label: showFullDetails ? 'Hide Details' : 'Show Details',
      action: () => setShowFullDetails(!showFullDetails),
      variant: 'secondary',
    });
  }

  return (
    <div className={`max-w-md w-full bg-white border rounded-lg shadow-lg p-4 mb-3 ${getSeverityColor()}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getErrorIcon()}
        </div>
        <div className="ml-3 flex-1">
          <h4 className="text-sm font-semibold text-gray-900">{error.userMessage}</h4>
          
          <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>{new Date(error.timestamp).toLocaleTimeString()}</span>
            {error.networkId && (
              <>
                <span>•</span>
                <Wifi className="w-3 h-3" />
                <span>Network {error.networkId}</span>
              </>
            )}
          </div>
          
          {error.suggestedActions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-gray-700">Suggested actions:</p>
              <ul className="text-xs text-gray-600 list-disc list-inside mt-1">
                {error.suggestedActions.slice(0, 2).map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
              </ul>
            </div>
          )}
          
          {showFullDetails && (
            <div className="mt-3 p-2 bg-gray-100 rounded text-xs">
              <p><strong>Technical Details:</strong></p>
              <p className="mt-1 text-gray-700">{error.technicalDetails}</p>
              {error.context && Object.keys(error.context).length > 0 && (
                <div className="mt-2">
                  <p><strong>Context:</strong></p>
                  <pre className="mt-1 text-xs bg-white p-2 rounded overflow-x-auto">
                    {JSON.stringify(error.context, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          
          {actions.length > 0 && (
            <div className="flex space-x-2 mt-3">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.action}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    action.variant === 'primary'
                      ? 'bg-blue-500 text-gray-900 hover:bg-blue-600'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Main notification system component
const ErrorNotificationSystem: React.FC<NotificationSystemProps> = ({
  maxNotifications = 5,
  defaultDuration = 5000,
  position = 'top-right',
  className = '',
}) => {
  const [notifications, setNotifications] = useState<NotificationProps[]>([]);
  const [errorNotifications, setErrorNotifications] = useState<{
    id: string;
    error: NetworkError;
    onRetry?: () => Promise<void>;
  }[]>([]);
  
  const { errorState, retryLastOperation } = useErrorHandler();

  // Add error notifications when new errors occur
  useEffect(() => {
    if (errorState.currentError) {
      const id = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      setErrorNotifications(prev => {
        const newNotifications = [{
          id,
          error: errorState.currentError!,
          onRetry: errorState.currentError!.recoverable ? async () => { await retryLastOperation(); } : undefined,
        }, ...prev];
        
        return newNotifications.slice(0, maxNotifications);
      });
    }
  }, [errorState.currentError, maxNotifications, retryLastOperation]);

  const addNotification = useCallback((notification: Omit<NotificationProps, 'id'>) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: NotificationProps = {
      ...notification,
      id,
      duration: notification.duration ?? defaultDuration,
      onClose: () => removeNotification(id),
    };
    
    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      return updated.slice(0, maxNotifications);
    });
  }, [defaultDuration, maxNotifications]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const removeErrorNotification = useCallback((id: string) => {
    setErrorNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setErrorNotifications([]);
  }, []);

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2';
      default:
        return 'top-4 right-4';
    }
  };

  // Expose methods globally for use in error handlers
  useEffect(() => {
    (window as any).addNotification = addNotification;
    (window as any).clearAllNotifications = clearAllNotifications;
    
    return () => {
      delete (window as any).addNotification;
      delete (window as any).clearAllNotifications;
    };
  }, [addNotification, clearAllNotifications]);

  const hasNotifications = notifications.length > 0 || errorNotifications.length > 0;

  if (!hasNotifications) return null;

  return (
    <div className={`fixed z-50 ${getPositionClasses()} ${className}`}>
      <div className="space-y-3">
        {/* Error notifications (higher priority) */}
        {errorNotifications.map(({ id, error, onRetry }) => (
          <ErrorNotification
            key={id}
            error={error}
            onRetry={onRetry}
            onDismiss={() => removeErrorNotification(id)}
            showDetails={true}
          />
        ))}
        
        {/* Regular notifications */}
        {notifications.map(notification => (
          <Notification key={notification.id} {...notification} />
        ))}
        
        {/* Clear all button when there are many notifications */}
        {(notifications.length + errorNotifications.length) > 2 && (
          <div className="text-center">
            <button
              onClick={clearAllNotifications}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear all notifications
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Hook for using the notification system
export const useNotifications = () => {
  const addNotification = useCallback((notification: Omit<NotificationProps, 'id'>) => {
    if ((window as any).addNotification) {
      (window as any).addNotification(notification);
    }
  }, []);

  const clearAll = useCallback(() => {
    if ((window as any).clearAllNotifications) {
      (window as any).clearAllNotifications();
    }
  }, []);

  const showSuccess = useCallback((title: string, message: string, duration?: number) => {
    addNotification({ type: 'success', title, message, duration });
  }, [addNotification]);

  const showError = useCallback((title: string, message: string, persistent?: boolean) => {
    addNotification({ type: 'error', title, message, persistent });
  }, [addNotification]);

  const showWarning = useCallback((title: string, message: string, duration?: number) => {
    addNotification({ type: 'warning', title, message, duration });
  }, [addNotification]);

  const showInfo = useCallback((title: string, message: string, duration?: number) => {
    addNotification({ type: 'info', title, message, duration });
  }, [addNotification]);

  return {
    addNotification,
    clearAll,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
};

export { Notification, ErrorNotification };
export default ErrorNotificationSystem;