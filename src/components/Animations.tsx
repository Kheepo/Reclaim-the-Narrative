import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface AnimatedIconProps {
  type: 'success' | 'error' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  className?: string;
}

export const AnimatedIcon: React.FC<AnimatedIconProps> = ({
  type,
  size = 'md',
  animate = true,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(true);
    }
  }, [animate]);

  const sizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  const getIcon = () => {
    const iconClass = `${sizeClasses[size]} ${className}`;
    
    switch (type) {
      case 'success':
        return <CheckCircleIcon className={`${iconClass} text-success-500`} />;
      case 'error':
        return <XCircleIcon className={`${iconClass} text-error-500`} />;
      case 'warning':
        return <ExclamationTriangleIcon className={`${iconClass} text-warning-500`} />;
      case 'info':
        return <InformationCircleIcon className={`${iconClass} text-primary-500`} />;
    }
  };

  const animationClass = animate
    ? `transform transition-all duration-slow ${
        isVisible
          ? 'scale-100 opacity-100 rotate-0'
          : 'scale-0 opacity-0 rotate-180'
      }`
    : '';

  return (
    <div className={`inline-flex ${animationClass}`}>
      {getIcon()}
    </div>
  );
};

interface StatusCardProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  animate?: boolean;
  className?: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  type,
  title,
  message,
  action,
  animate = true,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setIsVisible(true), 200);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(true);
    }
  }, [animate]);

  const getColorClasses = () => {
    switch (type) {
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

  const animationClass = animate
    ? `transform transition-all duration-slow ${
        isVisible
          ? 'translate-y-0 opacity-100 scale-100'
          : 'translate-y-4 opacity-0 scale-95'
      }`
    : '';

  return (
    <div
      className={`
        card border ${getColorClasses()} ${animationClass} ${className}
      `}
    >
      <div className="flex items-start space-x-4">
        <AnimatedIcon type={type} size="lg" animate={animate} />
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            {title}
          </h3>
          {message && (
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              {message}
            </p>
          )}
          {action && (
            <button
              onClick={action.onClick}
              className="btn-primary"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: 'fast' | 'normal' | 'slow';
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  className?: string;
}

export const FadeIn: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  duration = 'normal',
  direction = 'up',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const durationClasses = {
    fast: 'duration-fast',
    normal: 'duration-normal',
    slow: 'duration-slow',
  };

  const getTransformClasses = () => {
    const base = 'transform transition-all';
    const durationClass = durationClasses[duration];
    
    if (isVisible) {
      return `${base} ${durationClass} translate-x-0 translate-y-0 opacity-100 scale-100`;
    }

    switch (direction) {
      case 'up':
        return `${base} ${durationClass} translate-y-4 opacity-0 scale-95`;
      case 'down':
        return `${base} ${durationClass} -translate-y-4 opacity-0 scale-95`;
      case 'left':
        return `${base} ${durationClass} translate-x-4 opacity-0 scale-95`;
      case 'right':
        return `${base} ${durationClass} -translate-x-4 opacity-0 scale-95`;
      case 'none':
        return `${base} ${durationClass} opacity-0 scale-95`;
      default:
        return `${base} ${durationClass} translate-y-4 opacity-0 scale-95`;
    }
  };

  return (
    <div className={`${getTransformClasses()} ${className}`}>
      {children}
    </div>
  );
};

interface SlideInProps {
  children: React.ReactNode;
  direction: 'left' | 'right' | 'up' | 'down';
  isVisible: boolean;
  duration?: 'fast' | 'normal' | 'slow';
  className?: string;
}

export const SlideIn: React.FC<SlideInProps> = ({
  children,
  direction,
  isVisible,
  duration = 'normal',
  className = '',
}) => {
  const durationClasses = {
    fast: 'duration-fast',
    normal: 'duration-normal',
    slow: 'duration-slow',
  };

  const getTransformClasses = () => {
    const base = `transform transition-all ${durationClasses[duration]} ease-out`;
    
    if (isVisible) {
      return `${base} translate-x-0 translate-y-0 opacity-100`;
    }

    switch (direction) {
      case 'left':
        return `${base} -translate-x-full opacity-0`;
      case 'right':
        return `${base} translate-x-full opacity-0`;
      case 'up':
        return `${base} -translate-y-full opacity-0`;
      case 'down':
        return `${base} translate-y-full opacity-0`;
      default:
        return `${base} translate-x-full opacity-0`;
    }
  };

  return (
    <div className={`${getTransformClasses()} ${className}`}>
      {children}
    </div>
  );
};

interface PulseProps {
  children: React.ReactNode;
  isActive?: boolean;
  intensity?: 'subtle' | 'normal' | 'strong';
  className?: string;
}

export const Pulse: React.FC<PulseProps> = ({
  children,
  isActive = true,
  intensity = 'normal',
  className = '',
}) => {
  const intensityClasses = {
    subtle: 'animate-pulseSubtle',
    normal: 'animate-pulse',
    strong: 'animate-pulse',
  };

  return (
    <div className={`${isActive ? intensityClasses[intensity] : ''} ${className}`}>
      {children}
    </div>
  );
};

interface ScaleOnHoverProps {
  children: React.ReactNode;
  scale?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ScaleOnHover: React.FC<ScaleOnHoverProps> = ({
  children,
  scale = 'md',
  className = '',
}) => {
  const scaleClasses = {
    sm: 'hover:scale-105',
    md: 'hover:scale-110',
    lg: 'hover:scale-125',
  };

  return (
    <div className={`transform transition-transform duration-fast ${scaleClasses[scale]} ${className}`}>
      {children}
    </div>
  );
};

// Staggered animation container
interface StaggeredAnimationProps {
  children: React.ReactNode[];
  delay?: number;
  staggerDelay?: number;
  className?: string;
}

export const StaggeredAnimation: React.FC<StaggeredAnimationProps> = ({
  children,
  delay = 0,
  staggerDelay = 100,
  className = '',
}) => {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <FadeIn
          key={index}
          delay={delay + index * staggerDelay}
          direction="up"
        >
          {child}
        </FadeIn>
      ))}
    </div>
  );
};