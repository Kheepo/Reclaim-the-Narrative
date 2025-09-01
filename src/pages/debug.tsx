import React from 'react';
import { NetworkDiagnostic } from '../components/NetworkDiagnostic';
import WalletConnection from '../components/WalletConnection';

export default function DebugPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Blockchain Debug Console
          </h1>
          <p className="text-lg text-gray-600">
            Diagnose blockchain transaction issues and test network connectivity
          </p>
        </div>
        
        <div className="space-y-8">
          {/* Wallet Connection */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Wallet Connection
            </h2>
            <WalletConnection />
          </div>
          
          {/* Network Diagnostic */}
          <NetworkDiagnostic />
        </div>
      </div>
    </div>
  );
}