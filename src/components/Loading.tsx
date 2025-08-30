import React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'white' | 'neutral';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  const colorClasses = {
    primary: 'text-primary-600',
    white: 'text-white',
    neutral: 'text-neutral-600',
  };

  return (
    <ArrowPathIcon
      className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
    />
  );
};

interface LoadingDotsProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'neutral';
  className?: string;
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({
  size = 'md',
  color = 'primary',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'h-1 w-1',
    md: 'h-2 w-2',
    lg: 'h-3 w-3',
  };

  const colorClasses = {
    primary: 'bg-primary-600',
    white: 'bg-white',
    neutral: 'bg-neutral-600',
  };

  return (
    <div className={`flex space-x-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-pulse`}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: '1s',
          }}
        />
      ))}
    </div>
  );
};

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
  avatar?: boolean;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  className = '',
  lines = 3,
  avatar = false,
}) => {
  return (
    <div className={`animate-pulse ${className}`}>
      {avatar && (
        <div className="flex items-center space-x-4 mb-4">
          <div className="rounded-full bg-neutral-200 dark:bg-neutral-700 h-10 w-10"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
            <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded"
            style={{
              width: i === lines - 1 ? '75%' : '100%',
            }}
          ></div>
        ))}
      </div>
    </div>
  );
};

interface LoadingCardProps {
  className?: string;
}

export const LoadingCard: React.FC<LoadingCardProps> = ({ className = '' }) => {
  return (
    <div className={`card animate-pulse ${className}`}>
      <div className="h-48 bg-neutral-200 dark:bg-neutral-700 rounded-t-lg mb-4"></div>
      <div className="p-6">
        <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded mb-3"></div>
        <div className="space-y-2">
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-5/6"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-4/6"></div>
        </div>
        <div className="mt-6 flex space-x-3">
          <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded flex-1"></div>
          <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded w-24"></div>
        </div>
      </div>
    </div>
  );
};

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  children?: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message = 'Loading...',
  children,
}) => {
  if (!isVisible) return <>{children}</>;

  return (
    <div className="relative">
      {children}
      <div className="absolute inset-0 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400 font-medium">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
};

interface LoadingButtonProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading,
  children,
  className = '',
  disabled = false,
  onClick,
  type = 'button',
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        relative inline-flex items-center justify-center
        transition-all duration-fast
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {isLoading && (
        <LoadingSpinner
          size="sm"
          color="white"
          className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2"
        />
      )}
      <span className={isLoading ? 'opacity-0' : 'opacity-100'}>
        {children}
      </span>
    </button>
  );
};

interface ProgressBarProps {
  progress: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  size = 'md',
  color = 'primary',
  showLabel = false,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const colorClasses = {
    primary: 'bg-primary-600',
    success: 'bg-success-600',
    warning: 'bg-warning-600',
    error: 'bg-error-600',
  };

  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-between text-sm text-neutral-600 dark:text-neutral-400 mb-2">
          <span>Progress</span>
          <span>{Math.round(clampedProgress)}%</span>
        </div>
      )}
      <div className={`w-full bg-neutral-200 dark:bg-neutral-700 rounded-full ${sizeClasses[size]}`}>
        <div
          className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full transition-all duration-slow ease-out`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};

// Page-level loading component
interface PageLoadingProps {
  message?: string;
}

export const PageLoading: React.FC<PageLoadingProps> = ({
  message = 'Loading page...',
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="xl" className="mx-auto mb-6" />
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          {message}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400">
          Please wait while we load your content
        </p>
      </div>
    </div>
  );
};