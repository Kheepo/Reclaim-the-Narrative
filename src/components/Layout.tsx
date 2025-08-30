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
              <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
                &copy; 2024 GBV Reporting Platform. Built with privacy and security in mind.
              </p>
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