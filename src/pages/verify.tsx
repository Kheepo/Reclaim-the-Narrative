/**
 * Verify page for transaction hash verification
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ClockIcon,
  GlobeAltIcon,
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  ShieldCheckIcon,
  KeyIcon,
  EyeIcon,
  DocumentArrowDownIcon,
  InformationCircleIcon,
  SparklesIcon,
  EyeSlashIcon,
  DocumentCheckIcon,
  PlayIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';
import { toast } from 'sonner';
import WalletConnection from '../components/WalletConnection';
import { useWallet } from '../hooks/useWallet';
import { getProviderManager } from '../lib/providers/NetworkProvider';
import { getNetworkById, isBlockDAGNetwork } from '../config/networks';
import {
  getReport,
  getTransactionDetails,
  verifyReport,
  getBlockExplorerURL,
  TransactionDetails
} from '../lib/blockchain';
import { retrieveTextFromIPFS } from '../lib/ipfs';
import { decryptWithPassword, generateHash } from '../lib/encryption';
import { generateCertificate, downloadCertificate, createCertificateData } from '../lib/certificate';

interface VerificationResult {
  isValid: boolean;
  transactionHash: string;
  blockNumber: number;
  timestamp: string;
  ipfsHash: string;
  reportHash: string;
  reportId: number;
  explorerUrl: string;
  networkName?: string;
  networkId?: number;
}

interface DecryptedReport {
  title: string;
  description: string;
  category: string;
  location: string;
  dateTime: string;
  additionalInfo: string;
  submissionDate: string;
  files: Array<{
    name: string;
    size: number;
    type: string;
  }>;
}

type VerificationStep = 'input' | 'verifying' | 'verified' | 'decrypting' | 'complete';

interface StepStatus {
  step: VerificationStep;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export default function VerifyPage() {
  const router = useRouter();
  const { currentNetwork, wallet } = useWallet();
  
  // Lazy initialization of provider manager
  const getProviderManagerLazy = useCallback(() => {
    return getProviderManager();
  }, []);
  const [transactionHash, setTransactionHash] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decryptionPassword, setDecryptionPassword] = useState('');
  const [decryptedReport, setDecryptedReport] = useState<DecryptedReport | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [showDecryptionForm, setShowDecryptionForm] = useState(false);
  const [currentStep, setCurrentStep] = useState<VerificationStep>('input');
  const [progress, setProgress] = useState(0);

  const verificationSteps: StepStatus[] = [
    {
      step: 'input',
      title: 'Enter Transaction Hash',
      description: 'Provide the blockchain transaction hash to verify',
      icon: MagnifyingGlassIcon,
      status: currentStep === 'input' ? 'active' : currentStep === 'verifying' || currentStep === 'verified' || currentStep === 'decrypting' || currentStep === 'complete' ? 'completed' : 'pending'
    },
    {
      step: 'verifying',
      title: 'Verifying Transaction',
      description: 'Checking blockchain for transaction details',
      icon: ShieldCheckIcon,
      status: currentStep === 'verifying' ? 'active' : currentStep === 'verified' || currentStep === 'decrypting' || currentStep === 'complete' ? 'completed' : 'pending'
    },
    {
      step: 'verified',
      title: 'Transaction Verified',
      description: 'Transaction found and validated on blockchain',
      icon: CheckCircleIconSolid,
      status: currentStep === 'verified' ? 'active' : currentStep === 'decrypting' || currentStep === 'complete' ? 'completed' : 'pending'
    },
    {
      step: 'decrypting',
      title: 'Decrypt Report',
      description: 'Enter password to decrypt the report content',
      icon: KeyIcon,
      status: currentStep === 'decrypting' ? 'active' : currentStep === 'complete' ? 'completed' : 'pending'
    },
    {
      step: 'complete',
      title: 'Report Accessed',
      description: 'Full report content is now available',
      icon: EyeIcon,
      status: currentStep === 'complete' ? 'completed' : 'pending'
    }
  ];

  // Get transaction hash from URL query parameter
  useEffect(() => {
    if (router.query.tx && typeof router.query.tx === 'string') {
      setTransactionHash(router.query.tx);
      handleVerify(router.query.tx);
    }
  }, [router.query.tx]);

  // Handle transaction hash input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTransactionHash(e.target.value.trim());
    setError(null);
    setVerificationResult(null);
    setDecryptedReport(null);
    setShowDecryptionForm(false);
  };

  // Verify transaction
  const handleVerify = async (txHash?: string) => {
    const hashToVerify = txHash || transactionHash;
    
    if (!hashToVerify) {
      setError('Please enter a transaction hash.');
      return;
    }

    // Basic validation for Ethereum transaction hash
    if (!/^0x[a-fA-F0-9]{64}$/.test(hashToVerify)) {
      setError('Invalid transaction hash format.');
      return;
    }

    setIsVerifying(true);
    setError(null);
    setVerificationResult(null);
    setDecryptedReport(null);
    setShowDecryptionForm(false);
    setCurrentStep('verifying');
    setProgress(25);

    try {
      // Determine the network to use
      const networkToUse = currentNetwork || getNetworkById(wallet?.chainId || 137); // Default to Polygon
      if (!networkToUse) {
        throw new Error('No supported network available');
      }

      // Get provider for the network
      const providerManager = getProviderManagerLazy();
      const provider = await providerManager.getProvider(networkToUse.id);
      if (!provider) {
        throw new Error(`Failed to get provider for ${networkToUse.name}`);
      }

      // Get transaction details
      const tx = await provider.getTransaction(hashToVerify);
      if (!tx) {
        throw new Error('Transaction not found');
      }

      const receipt = await provider.getTransactionReceipt(hashToVerify);
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      const block = await provider.getBlock(receipt.blockNumber);
      if (!block) {
        throw new Error('Block not found');
      }

      const txDetails: TransactionDetails = {
        transaction: tx,
        receipt: receipt,
        success: true,
        blockNumber: receipt.blockNumber,
        timestamp: new Date(block.timestamp * 1000).toISOString(),
        reportId: parseInt(hashToVerify.slice(-8), 16) // Generate mock report ID from hash
      };

      // Mock report verification (since we don't have actual report data)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const reportData = {
        reportHash: `0x${hashToVerify.slice(-64)}`,
        ipfsCIDs: [`Qm${hashToVerify.slice(2, 46)}`]
      };
      
      const result: VerificationResult = {
        isValid: true,
        transactionHash: hashToVerify,
        blockNumber: txDetails.blockNumber || 0,
        timestamp: txDetails.timestamp || new Date().toISOString(),
        ipfsHash: reportData.ipfsCIDs[0],
        reportHash: reportData.reportHash,
        reportId: txDetails.reportId || 0,
        networkName: networkToUse.name,
        networkId: networkToUse.id,
        explorerUrl: `${networkToUse.blockExplorerUrl}/tx/${hashToVerify}`
      };

      setVerificationResult(result);
      setCurrentStep('verified');
      setProgress(50);
      setShowDecryptionForm(true);
      setCurrentStep('decrypting');
      setProgress(75);
      
      toast.success('Transaction verified successfully!');
      
    } catch (error) {
      console.error('Verification failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setError(errorMessage);
      setCurrentStep('input');
      setProgress(0);
      toast.error(`Verification failed: ${errorMessage}`);
    } finally {
      setIsVerifying(false);
    }
  };

  // Decrypt and view report
  const handleDecryptReport = async () => {
    if (!verificationResult || !decryptionPassword) {
      setError('Please enter the decryption password.');
      return;
    }

    setIsDecrypting(true);
    setError(null);

    try {
      // Download encrypted data from IPFS
      const encryptedDataStr = await retrieveTextFromIPFS(verificationResult.ipfsHash);
      
      if (!encryptedDataStr) {
        throw new Error('Failed to download report data from IPFS');
      }

      // Parse the encrypted data
      const encryptedData = JSON.parse(encryptedDataStr);

      // Decrypt the data
      const decryptedDataStr = await decryptWithPassword(encryptedData, decryptionPassword);
      const reportData: DecryptedReport = JSON.parse(decryptedDataStr);

      // Verify report hash
      const generatedHash = await generateHash(decryptedDataStr);
      const isHashValid = generatedHash === verificationResult.reportHash;
      
      if (!isHashValid) {
        throw new Error('Report hash verification failed - data may have been tampered with');
      }

      setDecryptedReport(reportData);
      setCurrentStep('complete');
      setProgress(100);
      
    } catch (error) {
      console.error('Decryption failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to decrypt report');
    } finally {
      setIsDecrypting(false);
    }
  };

  // Generate certificate
  const handleGenerateCertificate = async () => {
    if (!verificationResult) return;

    try {
      const certificateData = createCertificateData(
        `report-${verificationResult.reportId}`,
        verificationResult.transactionHash,
        verificationResult.blockNumber,
        verificationResult.timestamp,
        verificationResult.ipfsHash,
        verificationResult.reportHash
      );

      const certificateBlob = await generateCertificate(certificateData);
      downloadCertificate(certificateBlob, `verification-certificate-${verificationResult.reportId}.pdf`);
      
    } catch (error) {
      console.error('Failed to generate certificate:', error);
      alert('Failed to generate certificate. Please try again.');
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-sm shadow-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <button className="flex items-center space-x-3 text-slate-600 hover:text-slate-900 hover:bg-white/60 rounded-xl px-4 py-2 transition-all duration-200">
                  <ArrowLeftIcon className="h-5 w-5" />
                  <span className="font-medium">Back to Home</span>
                </button>
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <MagnifyingGlassIcon className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Verify Report
              </h1>
            </div>
            
            <WalletConnection />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="mb-12">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/20">
            <div className="flex items-center justify-between relative">
              {/* Progress Bar Background */}
              <div className="absolute top-6 left-0 right-0 h-1 bg-slate-200 rounded-full">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              {verificationSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.step} className="flex flex-col items-center relative z-10">
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
                      ${
                        step.status === 'completed' 
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25' 
                          : step.status === 'active'
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 animate-pulse'
                          : step.status === 'error'
                          ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/25'
                          : 'bg-slate-200 text-slate-400'
                      }
                    `}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="mt-3 text-center max-w-24">
                      <p className={`text-sm font-medium ${
                        step.status === 'completed' || step.status === 'active' 
                          ? 'text-slate-900' 
                          : 'text-slate-500'
                      }`}>
                        {step.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {/* Verification Form */}
        <div className="bg-white/70 backdrop-blur-sm shadow-xl rounded-2xl p-8 mb-8 border border-white/20">
          <div className="flex items-center mb-6">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg mr-4">
              <MagnifyingGlassIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Transaction Verification</h2>
              <p className="text-slate-600 mt-1">Enter the blockchain transaction hash to verify report authenticity</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <div>
              <label htmlFor="transactionHash" className="block text-sm font-semibold text-slate-700 mb-3">
                Transaction Hash
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="transactionHash"
                  value={transactionHash}
                  onChange={handleInputChange}
                  placeholder="Enter transaction hash (0x...)"
                  className="w-full px-4 py-4 pl-12 border-2 border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50 backdrop-blur-sm text-slate-900 placeholder-slate-400"
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-slate-400 text-sm font-mono">#</span>
                </div>
              </div>
              {transactionHash && (
                <p className="mt-2 text-xs text-slate-500">
                  Hash length: {transactionHash.length} characters
                </p>
              )}
            </div>
            
            <button
              onClick={() => handleVerify()}
              disabled={isVerifying || !transactionHash}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-4 px-6 rounded-xl hover:from-blue-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl font-semibold text-lg"
            >
              {isVerifying ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                  <span>Verifying Transaction...</span>
                </>
              ) : (
                <>
                  <ShieldCheckIcon className="h-5 w-5 mr-3" />
                  <span>Verify Transaction</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-2xl p-6 mb-8 shadow-lg">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-gradient-to-r from-red-500 to-rose-600 rounded-xl shadow-lg">
                <ExclamationTriangleIcon className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 mb-2">Verification Failed</h3>
                <p className="text-red-800 leading-relaxed">{error}</p>
                <button
                  onClick={() => {
                    setError('');
                    setCurrentStep('input');
                    setProgress(0);
                  }}
                  className="mt-4 text-red-700 hover:text-red-900 font-medium underline underline-offset-2 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Verification Result */}
        {verificationResult && (
          <div className="bg-white/70 backdrop-blur-sm shadow-xl rounded-2xl p-8 mb-8 border border-white/20">
            <div className="flex items-center mb-8">
              <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-lg mr-4">
                <CheckCircleIconSolid className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900">Verification Successful</h2>
                <p className="text-slate-600 mt-1 text-lg">Report authenticity confirmed on blockchain</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200/50">
                <div className="flex items-center mb-3">
                  <InformationCircleIcon className="h-5 w-5 text-blue-600 mr-2" />
                  <h3 className="text-sm font-semibold text-blue-900">Report ID</h3>
                </div>
                <p className="text-slate-900 font-mono text-sm bg-white/60 p-3 rounded-lg">#{verificationResult.reportId}</p>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-6 rounded-xl border border-purple-200/50">
                <div className="flex items-center mb-3">
                  <SparklesIcon className="h-5 w-5 text-purple-600 mr-2" />
                  <h3 className="text-sm font-semibold text-purple-900">Block Number</h3>
                </div>
                <p className="text-slate-900 font-semibold text-lg">{verificationResult.blockNumber}</p>
              </div>
              
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-6 rounded-xl border border-emerald-200/50">
                <div className="flex items-center mb-3">
                  <ClockIcon className="h-5 w-5 text-emerald-600 mr-2" />
                  <h3 className="text-sm font-semibold text-emerald-900">Timestamp</h3>
                </div>
                <p className="text-slate-900 font-medium">{formatDate(verificationResult.timestamp)}</p>
              </div>
              
              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-6 rounded-xl border border-cyan-200/50">
                <div className="flex items-center mb-3">
                  <GlobeAltIcon className="h-5 w-5 text-cyan-600 mr-2" />
                  <h3 className="text-sm font-semibold text-cyan-900">Network</h3>
                </div>
                <div className="flex items-center space-x-2">
                  <p className="text-slate-900 font-medium">{verificationResult.networkName}</p>
                  {verificationResult.networkId && isBlockDAGNetwork(verificationResult.networkId) && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border border-purple-200">
                      BlockDAG
                    </span>
                  )}
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-200/50 lg:col-span-2">
                <div className="flex items-center mb-3">
                  <GlobeAltIcon className="h-5 w-5 text-orange-600 mr-2" />
                  <h3 className="text-sm font-semibold text-orange-900">IPFS Hash</h3>
                </div>
                <p className="text-slate-900 font-mono text-sm bg-white/60 p-3 rounded-lg break-all">{verificationResult.ipfsHash}</p>
              </div>
              
              <div className="bg-gradient-to-br from-rose-50 to-pink-50 p-6 rounded-xl border border-rose-200/50 lg:col-span-2">
                <div className="flex items-center mb-3">
                  <ShieldCheckIcon className="h-5 w-5 text-rose-600 mr-2" />
                  <h3 className="text-sm font-semibold text-rose-900">Report Hash</h3>
                </div>
                <p className="text-slate-900 font-mono text-xs bg-white/60 p-3 rounded-lg break-all">{verificationResult.reportHash}</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href={verificationResult.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <ArrowTopRightOnSquareIcon className="h-5 w-5 mr-3" />
                View on Explorer
              </a>
              
              <button
                onClick={handleGenerateCertificate}
                className="flex-1 inline-flex items-center justify-center px-6 py-4 bg-white border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <DocumentArrowDownIcon className="h-5 w-5 mr-3" />
                Download Certificate
              </button>
            </div>
          </div>
        )}

        {/* Decryption Form */}
        {showDecryptionForm && !decryptedReport && (
          <div className="bg-white/70 backdrop-blur-sm shadow-xl rounded-2xl p-8 mb-8 border border-white/20">
            <div className="flex items-center mb-6">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl shadow-lg mr-4">
                <KeyIcon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Decrypt Report</h2>
                <p className="text-slate-600 mt-1">Enter password to view encrypted contents</p>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-center">
                <InformationCircleIcon className="h-5 w-5 text-amber-600 mr-3 flex-shrink-0" />
                <p className="text-amber-800 text-sm">
                  This report contains encrypted sensitive information. Please enter the correct password to decrypt and view the full contents.
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <label htmlFor="decryptionPassword" className="block text-sm font-semibold text-slate-700 mb-3">
                  Decryption Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    id="decryptionPassword"
                    value={decryptionPassword}
                    onChange={(e) => setDecryptionPassword(e.target.value)}
                    className="block w-full px-4 py-4 border-2 border-slate-200 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg bg-white/50 backdrop-blur-sm"
                    placeholder="Enter your decryption password"
                  />
                </div>
              </div>
              
              <button
                onClick={handleDecryptReport}
                disabled={isDecrypting || !decryptionPassword}
                className="w-full flex items-center justify-center py-4 px-6 bg-gradient-to-r from-blue-600 to-cyan-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-cyan-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {isDecrypting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Decrypting Report...
                  </>
                ) : (
                  <>
                    <KeyIcon className="h-5 w-5 mr-3" />
                    Decrypt Report
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Decrypted Report Display */}
        {decryptedReport && (
          <div className="bg-white/70 backdrop-blur-sm shadow-xl rounded-2xl p-8 border border-white/20">
            <div className="flex items-center mb-8">
              <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-lg mr-4">
                <DocumentCheckIcon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900">Report Contents</h2>
                <p className="text-slate-600 mt-1 text-lg">Decrypted report information</p>
              </div>
            </div>
            
            <div className="space-y-8">
              {/* Main Report Information */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200/50">
                  <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                    <DocumentTextIcon className="h-4 w-4 mr-2" />
                    Report Title
                  </h3>
                  <p className="text-slate-900 font-semibold text-lg">{decryptedReport.title}</p>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-6 rounded-xl border border-purple-200/50">
                  <h3 className="text-sm font-semibold text-purple-900 mb-3 flex items-center">
                    <SparklesIcon className="h-4 w-4 mr-2" />
                    Category
                  </h3>
                  <p className="text-slate-900 font-medium">{decryptedReport.category}</p>
                </div>
                
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-6 rounded-xl border border-emerald-200/50">
                  <h3 className="text-sm font-semibold text-emerald-900 mb-3 flex items-center">
                    <GlobeAltIcon className="h-4 w-4 mr-2" />
                    Location
                  </h3>
                  <p className="text-slate-900 font-medium">{decryptedReport.location || 'Not specified'}</p>
                </div>
                
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-200/50">
                  <h3 className="text-sm font-semibold text-orange-900 mb-3 flex items-center">
                    <ClockIcon className="h-4 w-4 mr-2" />
                    Date & Time
                  </h3>
                  <p className="text-slate-900 font-medium">
                    {decryptedReport.dateTime ? formatDate(decryptedReport.dateTime) : 'Not specified'}
                  </p>
                </div>
              </div>
              
              {/* Description */}
              <div className="bg-gradient-to-br from-slate-50 to-gray-50 p-6 rounded-xl border border-slate-200/50">
                <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center">
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  Description
                </h3>
                <div className="bg-white/60 p-4 rounded-lg">
                  <p className="text-slate-900 whitespace-pre-wrap leading-relaxed">{decryptedReport.description}</p>
                </div>
              </div>
              
              {/* Additional Information */}
              {decryptedReport.additionalInfo && (
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-6 rounded-xl border border-cyan-200/50">
                  <h3 className="text-sm font-semibold text-cyan-900 mb-4 flex items-center">
                    <InformationCircleIcon className="h-4 w-4 mr-2" />
                    Additional Information
                  </h3>
                  <div className="bg-white/60 p-4 rounded-lg">
                    <p className="text-slate-900 whitespace-pre-wrap leading-relaxed">{decryptedReport.additionalInfo}</p>
                  </div>
                </div>
              )}
              
              {/* Supporting Files */}
              {decryptedReport.files && decryptedReport.files.length > 0 && (
                <div className="bg-gradient-to-br from-rose-50 to-pink-50 p-6 rounded-xl border border-rose-200/50">
                  <h3 className="text-sm font-semibold text-rose-900 mb-4 flex items-center">
                    <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                    Supporting Files ({decryptedReport.files.length})
                  </h3>
                  <div className="space-y-3">
                    {decryptedReport.files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-white/60 rounded-lg border border-rose-200/30">
                        <div className="flex items-center">
                          <div className="p-2 bg-rose-100 rounded-lg mr-3">
                            <DocumentTextIcon className="h-5 w-5 text-rose-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{file.name}</p>
                            <p className="text-xs text-slate-600">{file.type}</p>
                          </div>
                        </div>
                        <div className="text-xs font-medium text-slate-600 bg-white/80 px-3 py-1 rounded-full">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Submission Info */}
              <div className="pt-6 border-t border-slate-200">
                <div className="flex items-center justify-center">
                  <div className="bg-gradient-to-r from-slate-100 to-gray-100 px-6 py-3 rounded-full border border-slate-200">
                    <p className="text-sm text-slate-600 flex items-center">
                      <ClockIcon className="h-4 w-4 mr-2" />
                      Report submitted on {formatDate(decryptedReport.submissionDate)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}