import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { toast } from 'sonner';
import { globalErrorHandler, ErrorCategory, ErrorSeverity, ErrorContext } from '../lib/error-handler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  level?: 'app' | 'page' | 'component';
  context?: Partial<ErrorContext>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const context: ErrorContext = {
      component: this.props.level || 'component',
      action: 'render',
      timestamp: Date.now(),
      metadata: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
        retryCount: this.state.retryCount,
        ...this.props.context
      }
    };

    // Handle error with global error handler
    const errorId = globalErrorHandler.handleError(
      error,
      ErrorCategory.UI,
      context,
      this.getErrorSeverity()
    );

    this.setState({
      errorInfo,
      errorId,
      retryCount: this.state.retryCount + 1
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log detailed error information
    this.logDetailedError(error, errorInfo, errorId);
  }

  private getErrorSeverity(): ErrorSeverity {
    switch (this.props.level) {
      case 'app':
        return ErrorSeverity.CRITICAL;
      case 'page':
        return ErrorSeverity.HIGH;
      case 'component':
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  private logDetailedError(error: Error, errorInfo: ErrorInfo, errorId: string) {
    const errorDetails = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      level: this.props.level,
      retryCount: this.state.retryCount,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      context: this.props.context
    };

    console.error('Error Boundary Caught Error:', errorDetails);

    // Send to external error tracking service
    this.reportToExternalService(errorDetails);
  }

  private async reportToExternalService(errorDetails: any) {
    try {
      // Example: Send to Sentry, LogRocket, or custom service
      // await errorTrackingService.captureException(errorDetails);
      console.log('Error reported to external service:', errorDetails.errorId);
    } catch (reportingError) {
      console.warn('Failed to report error to external service:', reportingError);
    }
  }

  private handleRetry = () => {
    if (this.state.retryCount >= 3) {
      toast.error('Maximum retry attempts reached. Please refresh the page.');
      return;
    }

    toast.info('Retrying...');
    
    // Clear the error state to retry rendering
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });

    // Mark error as resolved in global handler
    if (this.state.errorId) {
      globalErrorHandler.resolveError(this.state.errorId);
    }
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleReportBug = () => {
    const errorDetails = {
      errorId: this.state.errorId,
      message: this.state.error?.message,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };

    // Open bug report form or email
    const subject = encodeURIComponent(`Bug Report: ${this.state.error?.message}`);
    const body = encodeURIComponent(`Error Details:\n${JSON.stringify(errorDetails, null, 2)}`);
    window.open(`mailto:support@example.com?subject=${subject}&body=${body}`);
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Render appropriate error UI based on level
      return this.renderErrorUI();
    }

    return this.props.children;
  }

  private renderErrorUI() {
    const { level } = this.props;
    const { error, retryCount } = this.state;

    if (level === 'app') {
      return this.renderAppLevelError();
    }

    if (level === 'page') {
      return this.renderPageLevelError();
    }

    return this.renderComponentLevelError();
  }

  private renderAppLevelError() {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <AlertTriangle className="h-16 w-16 text-red-500" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Application Error
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Something went wrong. We're working to fix this issue.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Critical Error
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{this.state.error?.message || 'An unexpected error occurred'}</p>
                      {this.state.errorId && (
                        <p className="mt-1 text-xs">Error ID: {this.state.errorId}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-3">
                <button
                  onClick={this.handleRefresh}
                  className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Page
                </button>
                
                <button
                  onClick={this.handleReportBug}
                  className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <Bug className="h-4 w-4 mr-2" />
                  Report Bug
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  private renderPageLevelError() {
    return (
      <div className="min-h-96 flex flex-col justify-center items-center px-4">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Page Error
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            This page encountered an error and couldn't load properly.
          </p>
          
          {this.state.error && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">{this.state.error.message}</p>
              {this.state.errorId && (
                <p className="text-xs text-yellow-600 mt-1">ID: {this.state.errorId}</p>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            {this.state.retryCount < 3 && (
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </button>
            )}
            
            <button
              onClick={this.handleGoHome}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  private renderComponentLevelError() {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-red-800">
              Component Error
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{this.state.error?.message || 'This component failed to render'}</p>
            </div>
            
            {this.state.retryCount < 3 && (
              <div className="mt-3">
                <button
                  onClick={this.handleRetry}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

// Higher-order component for wrapping components with error boundaries
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = 
    `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundaryComponent;
}

// Specialized error boundaries for different levels
export const AppErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary level="app">
    {children}
  </ErrorBoundary>
);

export const PageErrorBoundary: React.FC<{ children: ReactNode; context?: Partial<ErrorContext> }> = ({ children, context }) => (
  <ErrorBoundary level="page" context={context}>
    {children}
  </ErrorBoundary>
);

export const ComponentErrorBoundary: React.FC<{ children: ReactNode; context?: Partial<ErrorContext> }> = ({ children, context }) => (
  <ErrorBoundary level="component" context={context}>
    {children}
  </ErrorBoundary>
);

export default ErrorBoundary;