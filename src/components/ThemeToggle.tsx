import React from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', size = 'md', showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleTheme();
    }
  };

  const sizeClasses = {
    sm: 'w-12 h-6',
    md: 'w-14 h-7',
    lg: 'w-16 h-8'
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const thumbSizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7'
  };

  const translateClasses = {
    sm: theme === 'dark' ? 'translate-x-6' : 'translate-x-0',
    md: theme === 'dark' ? 'translate-x-7' : 'translate-x-0',
    lg: theme === 'dark' ? 'translate-x-8' : 'translate-x-0'
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {showLabel && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {theme === 'light' ? 'Light' : 'Dark'} Mode
        </span>
      )}
      
      <button
        onClick={toggleTheme}
        onKeyDown={handleKeyDown}
        className={`
          relative inline-flex items-center ${sizeClasses[size]} 
          bg-gray-200 dark:bg-gray-700 rounded-full 
          transition-all duration-300 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-offset-2 
          focus:ring-indigo-500 dark:focus:ring-indigo-400
          focus:ring-offset-white dark:focus:ring-offset-gray-900
          hover:bg-gray-300 dark:hover:bg-gray-600
          group
        `}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        aria-pressed={theme === 'dark'}
        role="switch"
        title={`Currently in ${theme} mode. Click to switch to ${theme === 'light' ? 'dark' : 'light'} mode.`}
      >
        {/* Background gradient */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 opacity-0 dark:opacity-100 transition-opacity duration-300"></div>
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 opacity-100 dark:opacity-0 transition-opacity duration-300"></div>
        
        {/* Sliding thumb */}
        <div
          className={`
            relative ${thumbSizeClasses[size]} ${translateClasses[size]}
            bg-white dark:bg-gray-800 rounded-full shadow-lg
            transform transition-all duration-300 ease-in-out
            flex items-center justify-center
            group-hover:scale-110
          `}
        >
          {/* Sun icon (light mode) */}
          <SunIcon 
            className={`
              ${iconSizeClasses[size]} text-yellow-500
              absolute transition-all duration-300 ease-in-out
              ${theme === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-180 scale-75'}
            `}
          />
          
          {/* Moon icon (dark mode) */}
          <MoonIcon 
            className={`
              ${iconSizeClasses[size]} text-indigo-400
              absolute transition-all duration-300 ease-in-out
              ${theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-180 scale-75'}
            `}
          />
        </div>
        
        {/* Light mode icon background */}
        <div className={`absolute left-1 ${iconSizeClasses[size]} text-yellow-400 opacity-30 dark:opacity-0 transition-opacity duration-300`}>
          <SunIcon className="w-full h-full" />
        </div>
        
        {/* Dark mode icon background */}
        <div className={`absolute right-1 ${iconSizeClasses[size]} text-indigo-300 opacity-0 dark:opacity-30 transition-opacity duration-300`}>
          <MoonIcon className="w-full h-full" />
        </div>
      </button>
    </div>
  );
}

// Compact version for mobile/small spaces
export function CompactThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleTheme();
    }
  };

  return (
    <button
      onClick={toggleTheme}
      onKeyDown={handleKeyDown}
      className={`
        p-2 rounded-lg bg-white/10 dark:bg-gray-800/50 
        backdrop-blur-sm border border-white/20 dark:border-gray-700
        hover:bg-white/20 dark:hover:bg-gray-700/50
        focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400
        focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900
        transition-all duration-200 group
        ${className}
      `}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      aria-pressed={theme === 'dark'}
      role="switch"
      title={`Currently in ${theme} mode. Click to switch to ${theme === 'light' ? 'dark' : 'light'} mode.`}
    >
      <div className="relative w-5 h-5">
        <SunIcon 
          className={`
            w-5 h-5 text-yellow-500 absolute
            transition-all duration-300 ease-in-out
            ${theme === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-180 scale-75'}
          `}
          aria-hidden="true"
        />
        <MoonIcon 
          className={`
            w-5 h-5 text-indigo-400 absolute
            transition-all duration-300 ease-in-out
            ${theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-180 scale-75'}
          `}
          aria-hidden="true"
        />
      </div>
    </button>
  );
}