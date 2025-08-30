import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  HomeIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  DocumentCheckIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '../contexts/ThemeContext';
import WalletConnection from './WalletConnection';
import NetworkSwitcher from './NetworkSwitcher';
import { CompactThemeToggle } from './ThemeToggle';
import CrisisHotlineDropdown from './CrisisHotlineDropdown';

interface LayoutProps {
  children: React.ReactNode;
  showNavigation?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, showNavigation = true }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  const navigation = [
    { name: 'Home', href: '/', icon: HomeIcon },
    { name: 'Submit Report', href: '/submit', icon: ShieldCheckIcon },
    { name: 'Verify Report', href: '/verify', icon: MagnifyingGlassIcon },
    { name: 'Get Certificate', href: '/certificate', icon: DocumentCheckIcon },
  ];

  const isActivePage = (href: string) => {
    if (href === '/') {
      return router.pathname === '/';
    }
    return router.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50/30 to-secondary-50/30 dark:from-neutral-900 dark:via-primary-950/30 dark:to-secondary-950/30">
      {showNavigation && (
        <nav className="fixed top-0 w-full z-fixed bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 header-top">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-20 py-2">
              {/* Logo */}
              <Link href="/" className="flex items-center space-x-2 group">
                <div className="p-2 bg-gradient-primary rounded-lg group-hover:scale-105 transition-transform duration-fast">
                  <ShieldCheckIcon className="h-6 w-6 text-white" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold text-gradient">GBV Platform</h1>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">Secure &amp; Anonymous</p>
                </div>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center space-x-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = isActivePage(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`
                        flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-fast
                        ${
                          isActive
                            ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }
                      `}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Right side controls */}
              <div className="flex items-center space-x-4">
                {/* Network Switcher */}
                <NetworkSwitcher />

                {/* Wallet Connection */}
                <WalletConnection />

                {/* Theme Toggle */}
                <CompactThemeToggle />

                {/* Mobile menu button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                  aria-label="Toggle mobile menu"
                >
                  {mobileMenuOpen ? (
                    <XMarkIcon className="h-5 w-5" />
                  ) : (
                    <Bars3Icon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Mobile Navigation */}
            {mobileMenuOpen && (
              <div className="md:hidden py-6 border-t border-neutral-200 dark:border-neutral-800 animate-slide-down">
                <div className="space-y-3">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = isActivePage(item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`
                          flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-fast
                          ${
                            isActive
                              ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                              : 'text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                          }
                        `}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="flex-1 pt-20">
        {children}
      </main>

      {/* Footer */}
      {showNavigation && (
        <footer className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="p-2 bg-gradient-primary rounded-lg">
                    <ShieldCheckIcon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gradient">GBV Platform</h3>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Empowering survivors with secure, anonymous reporting powered by blockchain technology.
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Quick Links</h4>
                <ul className="space-y-2">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-fast"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Support</h4>
                <div className="space-y-2">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                    Access crisis hotlines and emergency contacts for your country:
                  </p>
                  <div className="flex justify-start">
                    <CrisisHotlineDropdown />
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-4 italic">
                    If you are in immediate danger, contact local emergency services.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  &copy; 2024 GBV Reporting Platform. Built with privacy and security in mind.
                </p>
                <a
                  href="https://github.com/ST10482726/Reclaim-the-Narrative"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-fast"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span>View on GitHub</span>
                </a>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Fixed Crisis Hotline Dropdown - Bottom Right */}
      <div className="fixed bottom-6 right-6 z-50">
        <CrisisHotlineDropdown />
      </div>
    </div>
  );
};

export default Layout;