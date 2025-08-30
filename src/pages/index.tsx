/**
 * Home page with safety disclaimer and navigation
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheckIcon,
  EyeSlashIcon,
  DocumentCheckIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  LockClosedIcon,
  CheckBadgeIcon,
  CubeTransparentIcon,
} from '@heroicons/react/24/outline';
import WalletConnection from '../components/WalletConnection';
import NetworkSwitcher from '../components/NetworkSwitcher';


export default function HomePage() {
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [hasAcceptedDisclaimer, setHasAcceptedDisclaimer] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);

  useEffect(() => {
    // Check if user has previously accepted disclaimer
    const accepted = localStorage.getItem('gbv_disclaimer_accepted');
    if (accepted === 'true') {
      setHasAcceptedDisclaimer(true);
    } else {
      setShowSafetyModal(true);
    }
  }, []);

  const handleAcceptDisclaimer = () => {
    localStorage.setItem('gbv_disclaimer_accepted', 'true');
    setHasAcceptedDisclaimer(true);
    setShowSafetyModal(false);
  };

  const handleWalletConnect = (address: string) => {
    setWalletConnected(true);
  };

  const handleWalletDisconnect = () => {
    setWalletConnected(false);
  };

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-20 lg:py-32">
        <div className="absolute inset-0 bg-grid-pattern opacity-5 z-0"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="flex items-center space-x-2 bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-medium">
                <SparklesIcon className="h-4 w-4" />
                <span>Powered by BlockDAG & Ethereum</span>
              </div>
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 mb-6 leading-normal tracking-wide">
              Secure, Anonymous
              <span className="block text-gradient bg-gradient-to-r from-primary-600 to-secondary-600">
                GBV Reporting
              </span>
            </h1>
            
            <p className="text-xl lg:text-2xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed">
              Report gender-based violence incidents securely and anonymously using 
              next-generation blockchain technology. Your safety and privacy are our top priorities.
            </p>
          
            {hasAcceptedDisclaimer && (
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                <Link href="/submit">
                  <button className="group relative inline-flex items-center px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-primary-300">
                    <span className="absolute inset-0 bg-gradient-to-r from-primary-700 to-primary-800 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                    <span className="relative flex items-center">
                      Submit Report
                      <ArrowRightIcon className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                    </span>
                  </button>
                </Link>
                
                <Link href="/verify">
                  <button className="group inline-flex items-center px-8 py-4 bg-white text-gray-700 text-lg font-semibold rounded-xl border-2 border-gray-200 hover:border-primary-300 hover:bg-primary-50 shadow-md hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-primary-200">
                    Verify Report
                    <DocumentCheckIcon className="ml-2 h-5 w-5 group-hover:text-primary-600 transition-colors duration-300" />
                  </button>
                </Link>
                
                <Link href="/certificate">
                  <button className="group inline-flex items-center px-8 py-4 bg-white text-gray-700 text-lg font-semibold rounded-xl border-2 border-gray-200 hover:border-secondary-300 hover:bg-secondary-50 shadow-md hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-secondary-200">
                    Get Certificate
                    <CheckBadgeIcon className="ml-2 h-5 w-5 group-hover:text-secondary-600 transition-colors duration-300" />
                  </button>
                </Link>
              </div>
            )}
        </div>

        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-normal tracking-wide">
              Why Choose Our Platform?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Built with cutting-edge technology to ensure maximum security, privacy, and reliability.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="group relative bg-gradient-to-br from-primary-50 to-primary-100 rounded-2xl p-8 border border-primary-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl opacity-0 group-hover:opacity-5 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="flex items-center justify-center w-16 h-16 bg-primary-600 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                  <LockClosedIcon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Complete Anonymity
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  Your identity is never stored or transmitted. All data is encrypted client-side before submission, ensuring complete privacy protection.
                </p>
              </div>
            </div>

            <div className="group relative bg-gradient-to-br from-success-50 to-success-100 rounded-2xl p-8 border border-success-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-success-600 to-success-700 rounded-2xl opacity-0 group-hover:opacity-5 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="flex items-center justify-center w-16 h-16 bg-success-600 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                  <CubeTransparentIcon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Multi-Chain Security
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  Reports are secured on both Ethereum and BlockDAG networks, ensuring tamper-proof records with next-generation blockchain technology.
                </p>
              </div>
            </div>

            <div className="group relative bg-gradient-to-br from-secondary-50 to-secondary-100 rounded-2xl p-8 border border-secondary-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary-600 to-secondary-700 rounded-2xl opacity-0 group-hover:opacity-5 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="flex items-center justify-center w-16 h-16 bg-secondary-600 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                  <CheckBadgeIcon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Legal Certificates
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  Generate verifiable PDF certificates with blockchain proof that can be used as legal evidence of report submission.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-normal tracking-wide">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              A simple, secure process designed to protect your privacy while ensuring accountability.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-4 gap-8">
            <div className="relative text-center group bg-white rounded-2xl p-8 border-2 border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-primary-300">
              <div className="flex items-center justify-center w-20 h-20 bg-white rounded-2xl mx-auto mb-6 text-2xl font-bold shadow-2xl border-4 border-primary-600 group-hover:scale-110 transition-transform duration-300 ring-4 ring-primary-100" style={{color: '#000000', backgroundColor: '#ffffff'}}>
                1
              </div>
              <div className="absolute top-12 left-full w-full h-1 bg-gradient-to-r from-primary-300 to-transparent hidden lg:block"></div>
              <h4 className="text-xl font-bold text-gray-900 mb-4">Submit Report</h4>
              <p className="text-gray-600 leading-relaxed">
                Fill out the secure form with incident details. All data is encrypted locally before transmission.
              </p>
            </div>
            
            <div className="relative text-center group bg-white rounded-2xl p-8 border-2 border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-success-300">
              <div className="flex items-center justify-center w-20 h-20 bg-white rounded-2xl mx-auto mb-6 text-2xl font-bold shadow-2xl border-4 border-success-600 group-hover:scale-110 transition-transform duration-300 ring-4 ring-success-100" style={{color: '#000000', backgroundColor: '#ffffff'}}>
                2
              </div>
              <div className="absolute top-12 left-full w-full h-1 bg-gradient-to-r from-success-300 to-transparent hidden lg:block"></div>
              <h4 className="text-xl font-bold text-gray-900 mb-4">Multi-Chain Storage</h4>
              <p className="text-gray-600 leading-relaxed">
                Encrypted data is stored on IPFS and anchored to both Ethereum and BlockDAG networks.
              </p>
            </div>
            
            <div className="relative text-center group bg-white rounded-2xl p-8 border-2 border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-secondary-300">
              <div className="flex items-center justify-center w-20 h-20 bg-white rounded-2xl mx-auto mb-6 text-2xl font-bold shadow-2xl border-4 border-secondary-600 group-hover:scale-110 transition-transform duration-300 ring-4 ring-secondary-100" style={{color: '#000000', backgroundColor: '#ffffff'}}>
                3
              </div>
              <div className="absolute top-12 left-full w-full h-1 bg-gradient-to-r from-secondary-300 to-transparent hidden lg:block"></div>
              <h4 className="text-xl font-bold text-gray-900 mb-4">Get Certificate</h4>
              <p className="text-gray-600 leading-relaxed">
                Receive a verifiable PDF certificate with blockchain proof of submission and legal validity.
              </p>
            </div>
            
            <div className="relative text-center group bg-white rounded-2xl p-8 border-2 border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-warning-300">
              <div className="flex items-center justify-center w-20 h-20 bg-white rounded-2xl mx-auto mb-6 text-2xl font-bold shadow-2xl border-4 border-warning-600 group-hover:scale-110 transition-transform duration-300 ring-4 ring-warning-100" style={{color: '#000000', backgroundColor: '#ffffff'}}>
                4
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-4">Verify Anytime</h4>
              <p className="text-gray-600 leading-relaxed">
                Anyone can verify the report&apos;s authenticity using the transaction hash on multiple blockchains.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Safety Disclaimer Modal */}
      {showSafetyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-modal-backdrop flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto z-modal">
            <div className="p-8">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-gradient-to-br from-warning-100 to-warning-200 rounded-2xl mb-6">
                <ExclamationTriangleIcon className="h-8 w-8 text-warning-600" />
              </div>
              
              <h3 className="text-3xl font-bold text-gray-900 text-center mb-8">
                Important Safety Information
              </h3>
              
              <div className="grid lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-gradient-to-br from-error-50 to-error-100 border-2 border-error-200 rounded-xl p-6">
                  <h4 className="text-xl font-bold text-error-800 mb-4 flex items-center">
                    <span className="text-2xl mr-2">⚠️</span>
                    Emergency Situations
                  </h4>
                  <p className="text-error-700 leading-relaxed">
                    If you are in immediate danger, please contact emergency services (911, 999, 112) 
                    or your local emergency number immediately. This platform is not for emergency situations.
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-200 rounded-xl p-6">
                  <h4 className="text-xl font-bold text-primary-800 mb-4 flex items-center">
                    <span className="text-2xl mr-2">🔒</span>
                    Privacy & Security
                  </h4>
                  <ul className="text-primary-700 space-y-2">
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Your identity is never stored or transmitted
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      All data is encrypted before leaving your device
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Use a secure, private internet connection
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Consider using a VPN for additional privacy
                    </li>
                  </ul>
                </div>
                
                <div className="bg-gradient-to-br from-success-50 to-success-100 border-2 border-success-200 rounded-xl p-6">
                  <h4 className="text-xl font-bold text-success-800 mb-4 flex items-center">
                    <span className="text-2xl mr-2">📋</span>
                    Report Guidelines
                  </h4>
                  <ul className="text-success-700 space-y-2">
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-success-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Provide as much detail as possible
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-success-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Include relevant dates, times, and locations
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-success-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Attach supporting evidence if available
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-success-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Reports are permanent and cannot be deleted
                    </li>
                  </ul>
                </div>
                
                <div className="bg-gradient-to-br from-secondary-50 to-secondary-100 border-2 border-secondary-200 rounded-xl p-6">
                  <h4 className="text-xl font-bold text-secondary-800 mb-4 flex items-center">
                    <span className="text-2xl mr-2">🏥</span>
                    Support Resources
                  </h4>
                  <p className="text-secondary-700 mb-3">
                    If you need immediate support, please contact:
                  </p>
                  <ul className="text-secondary-700 space-y-2">
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-secondary-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      National Domestic Violence Hotline: 1-800-799-7233
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-secondary-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      RAINN National Sexual Assault Hotline: 1-800-656-4673
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-secondary-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Crisis Text Line: Text HOME to 741741
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="flex items-center mb-6 p-4 bg-gradient-to-r from-neutral-50 to-neutral-100 rounded-xl border-2 border-neutral-300">
                <input
                  type="checkbox"
                  id="disclaimer-accept"
                  className="h-6 w-6 text-primary-600 focus:ring-primary-500 focus:ring-4 border-2 border-neutral-400 rounded-md transition-colors duration-200 cursor-pointer"
                  required
                />
                <label htmlFor="disclaimer-accept" className="ml-4 text-black font-medium cursor-pointer select-none">
                  I have read and understand the safety information above
                </label>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-end">
                <button
                  onClick={() => setShowSafetyModal(false)}
                  className="px-8 py-3 text-black bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all duration-200 font-medium border-2 border-neutral-300 hover:border-neutral-400 focus:outline-none focus:ring-4 focus:ring-neutral-200 focus:border-neutral-500 min-h-[48px] flex items-center justify-center"
                >
                  I&apos;ll be careful
                </button>
                <button
                  onClick={() => setShowSafetyModal(false)}
                  className="px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-primary-200 focus:ring-offset-2 min-h-[48px] flex items-center justify-center"
                >
                  I understand
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}