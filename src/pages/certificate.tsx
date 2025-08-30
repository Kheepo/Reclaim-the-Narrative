/**
 * Certificate page for displaying and managing certificates
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  GlobeAltIcon,
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  DocumentArrowDownIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import WalletConnection from '../components/WalletConnection';
import {
  getReport,
  getTransactionDetails,
  getBlockExplorerURL,
  verifyReport,
  TransactionDetails
} from '../lib/blockchain';
import {
  generateCertificate,
  downloadCertificate,
  createCertificateData,
  validateCertificateData,
  CertificateData
} from '../lib/certificate';

interface CertificateInfo {
  reportId: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: string;
  ipfsHash: string;
  reportHash: string;
  explorerUrl: string;
  isValid: boolean;
}

export default function CertificatePage() {
  const router = useRouter();
  const [transactionHash, setTransactionHash] = useState('');
  const [certificateInfo, setCertificateInfo] = useState<CertificateInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Get transaction hash from URL query parameter
  useEffect(() => {
    if (router.query.tx && typeof router.query.tx === 'string') {
      setTransactionHash(router.query.tx);
      loadCertificateInfo(router.query.tx);
    }
  }, [router.query.tx]);

  // Load certificate information
  const loadCertificateInfo = async (txHash: string) => {
    if (!txHash) return;

    setIsLoading(true);
    setError(null);
    setCertificateInfo(null);

    try {
      // Get transaction details
      const txDetails: TransactionDetails = await getTransactionDetails(txHash);
      
      if (!txDetails.success) {
        throw new Error('Transaction not found or failed');
      }

      // Get report data from blockchain using verifyReport
      const verificationResult = await verifyReport(txHash);
      
      if (!verificationResult.exists || !verificationResult.reportData) {
        throw new Error('Report data not found in transaction');
      }
      
      const reportData = verificationResult.reportData;
      
      const info: CertificateInfo = {
        reportId: `report-${txDetails.reportId || 'unknown'}`,
        transactionHash: txHash,
        blockNumber: txDetails.blockNumber || 0,
        timestamp: txDetails.timestamp || new Date().toISOString(),
        ipfsHash: reportData.ipfsCIDs[0] || '', // Use first IPFS CID
        reportHash: reportData.reportHash,
        explorerUrl: getBlockExplorerURL(txHash),
        isValid: true
      };

      setCertificateInfo(info);
      
    } catch (error) {
      console.error('Failed to load certificate info:', error);
      setError(error instanceof Error ? error.message : 'Failed to load certificate information');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle transaction hash input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setTransactionHash(value);
    setError(null);
    setCertificateInfo(null);
    
    // Auto-load if valid hash format
    if (/^0x[a-fA-F0-9]{64}$/.test(value)) {
      loadCertificateInfo(value);
    }
  };

  // Generate and download certificate
  const handleGenerateCertificate = async () => {
    if (!certificateInfo) return;

    setIsGenerating(true);

    try {
      const certificateData = createCertificateData(
        certificateInfo.reportId,
        certificateInfo.transactionHash,
        certificateInfo.blockNumber,
        certificateInfo.timestamp,
        certificateInfo.ipfsHash,
        certificateInfo.reportHash
      );

      // Validate certificate data
      const isValid = validateCertificateData(certificateData);
      if (!isValid) {
        throw new Error('Invalid certificate data');
      }

      const certificateBlob = await generateCertificate(certificateData);
      downloadCertificate(certificateBlob, `certificate-${certificateInfo.reportId}.pdf`);
      
    } catch (error) {
      console.error('Failed to generate certificate:', error);
      alert('Failed to generate certificate. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Format hash for display
  const formatHash = (hash: string, length: number = 16) => {
    if (hash.length <= length) return hash;
    return `${hash.slice(0, length)}...${hash.slice(-8)}`;
  };

  // Generate QR code URL (using a QR code service)
  const getQRCodeUrl = (data: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <Link href="/">
                <button className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors duration-200 group">
                  <ArrowLeftIcon className="h-5 w-5 group-hover:-translate-x-1 transition-transform duration-200" />
                  <span className="font-medium">Back to Home</span>
                </button>
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg">
                <DocumentTextIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Certificate Generator
                </h1>
                <p className="text-sm text-slate-500">Legal proof of blockchain submission</p>
              </div>
            </div>
            
            <WalletConnection />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Certificate Info */}
        <div className="bg-white/70 backdrop-blur-md shadow-xl rounded-2xl p-8 mb-8 border border-white/20">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl">
              <DocumentTextIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Generate Legal Certificate</h2>
              <p className="text-slate-600 mt-1">
                Create an official blockchain-verified certificate for your report submission
              </p>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6">
            <p className="text-slate-700 leading-relaxed">
              This certificate serves as cryptographic proof of your report submission on the blockchain. 
              It includes all necessary verification details and can be used for legal purposes, 
              providing immutable evidence of your submission timestamp and content integrity.
            </p>
          </div>
          
          <div className="space-y-6">
            <div>
              <label htmlFor="transactionHash" className="block text-sm font-semibold text-slate-700 mb-2">
                Transaction Hash
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="transactionHash"
                  value={transactionHash}
                  onChange={handleInputChange}
                  className="block w-full px-4 py-3 border-2 border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                  placeholder="0x1234567890abcdef..."
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <div className="h-2 w-2 bg-slate-400 rounded-full"></div>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-500 flex items-center space-x-2">
                <span>Enter the transaction hash from your blockchain report submission</span>
              </p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white/70 backdrop-blur-md shadow-xl rounded-2xl p-8 mb-8 border border-white/20">
            <div className="flex items-center justify-center space-x-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-200"></div>
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent absolute top-0 left-0"></div>
              </div>
              <div>
                <span className="text-lg font-medium text-slate-700">Loading certificate information...</span>
                <p className="text-sm text-slate-500 mt-1">Fetching blockchain data and generating certificate</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-2xl p-6 mb-8 shadow-lg">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-red-100 rounded-xl">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-800">Certificate Generation Error</h3>
                <p className="text-red-700 mt-2 leading-relaxed">{error}</p>
                <button
                  onClick={() => setError('')}
                  className="mt-4 inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Certificate Information */}
        {certificateInfo && (
          <div className="space-y-6">
            {/* Certificate Preview */}
            <div className="bg-white/90 backdrop-blur-md shadow-2xl rounded-3xl overflow-hidden border border-white/30">
              <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-8 py-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                      <CheckCircleIcon className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">Legal Certificate of Report Submission</h3>
                      <p className="text-white/80 mt-1">Blockchain-verified proof of submission</p>
                    </div>
                  </div>
                  <div className="text-right text-white/60">
                    <p className="text-sm font-medium">Certificate ID</p>
                    <p className="text-xs font-mono">{certificateInfo.reportId}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Certificate Details */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <label className="text-sm font-semibold text-slate-700">Report ID</label>
                        </div>
                        <p className="text-slate-900 font-mono text-sm break-all">{certificateInfo.reportId}</p>
                      </div>
                      
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-100">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <label className="text-sm font-semibold text-slate-700">Block Number</label>
                        </div>
                        <p className="text-slate-900 font-mono text-sm">{certificateInfo.blockNumber}</p>
                      </div>
                      
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-100">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                          <label className="text-sm font-semibold text-slate-700">Submission Time</label>
                        </div>
                        <p className="text-slate-900 text-sm">{formatDate(certificateInfo.timestamp)}</p>
                      </div>
                      
                      <div className="bg-gradient-to-br from-orange-50 to-red-50 p-4 rounded-xl border border-orange-100">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <label className="text-sm font-semibold text-slate-700">Network</label>
                        </div>
                        <p className="text-slate-900 text-sm font-medium">Polygon</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                            <label className="text-sm font-semibold text-slate-700">Transaction Hash</label>
                          </div>
                          <a
                            href={certificateInfo.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 transition-colors duration-200"
                          >
                            <span className="text-xs font-medium">View on Explorer</span>
                            <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                          </a>
                        </div>
                        <p className="text-slate-900 font-mono text-sm break-all bg-white p-3 rounded-lg border">
                          {formatHash(certificateInfo.transactionHash, 32)}
                        </p>
                      </div>
                      
                      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-5 rounded-xl border border-cyan-200">
                        <div className="flex items-center space-x-2 mb-3">
                          <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                          <label className="text-sm font-semibold text-slate-700">IPFS Hash</label>
                        </div>
                        <p className="text-slate-900 font-mono text-sm break-all bg-white p-3 rounded-lg border">
                          {formatHash(certificateInfo.ipfsHash, 32)}
                        </p>
                      </div>
                      
                      <div className="bg-gradient-to-r from-violet-50 to-purple-50 p-5 rounded-xl border border-violet-200">
                        <div className="flex items-center space-x-2 mb-3">
                          <div className="w-2 h-2 bg-violet-500 rounded-full"></div>
                          <label className="text-sm font-semibold text-slate-700">Report Hash</label>
                        </div>
                        <p className="text-slate-900 font-mono text-sm break-all bg-white p-3 rounded-lg border">
                          {formatHash(certificateInfo.reportHash, 32)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* QR Code */}
                  <div className="flex flex-col items-center space-y-6">
                    <div className="bg-gradient-to-br from-white to-slate-50 p-6 rounded-2xl border-2 border-slate-200 shadow-lg">
                      <div className="bg-white p-4 rounded-xl shadow-inner">
                        <img
                          src={getQRCodeUrl(certificateInfo.transactionHash)}
                          alt="Transaction QR Code"
                          className="w-36 h-36 rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="text-center bg-gradient-to-r from-slate-50 to-gray-50 p-4 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-center space-x-2 mb-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <p className="text-sm font-semibold text-slate-700">Quick Verification</p>
                      </div>
                      <p className="text-xs text-slate-500">Scan QR code to verify</p>
                      <p className="text-xs text-slate-500">transaction on blockchain</p>
                    </div>
                  </div>
                </div>
                
                {/* Certificate Text */}
                <div className="mt-8 p-8 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-2xl border-2 border-amber-200 shadow-lg">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="p-2 bg-amber-100 rounded-xl">
                      <DocumentTextIcon className="h-6 w-6 text-amber-600" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-900">Official Certificate Statement</h4>
                  </div>
                  
                  <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl border border-amber-100 space-y-4">
                    <p className="text-slate-700 leading-relaxed font-medium">
                      This certificate confirms that a report with ID <span className="font-mono bg-blue-100 px-2 py-1 rounded text-blue-800">{certificateInfo.reportId}</span> was 
                      successfully submitted to the blockchain on <span className="font-semibold text-emerald-700">{formatDate(certificateInfo.timestamp)}</span>. 
                      The report data has been encrypted and stored on IPFS with hash <span className="font-mono bg-cyan-100 px-2 py-1 rounded text-cyan-800">{formatHash(certificateInfo.ipfsHash, 16)}</span>, 
                      and the submission has been permanently recorded on the Polygon blockchain in block <span className="font-mono bg-purple-100 px-2 py-1 rounded text-purple-800">{certificateInfo.blockNumber}</span> 
                      with transaction hash <span className="font-mono bg-indigo-100 px-2 py-1 rounded text-indigo-800">{formatHash(certificateInfo.transactionHash, 16)}</span>.
                    </p>
                    
                    <div className="border-l-4 border-amber-400 pl-4 bg-amber-50/50 p-4 rounded-r-lg">
                      <p className="text-slate-700 leading-relaxed font-medium">
                        This certificate serves as <span className="font-bold text-slate-900">legal proof</span> of the report submission and can be verified independently 
                        using the provided blockchain transaction hash. The integrity and authenticity of this submission 
                        are guaranteed by the <span className="font-bold text-slate-900">immutable nature of blockchain technology</span>.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Verification Info */}
                <div className="mt-6 p-6 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 rounded-2xl border-2 border-emerald-200 shadow-lg">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-emerald-100 rounded-xl">
                      <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
                    </div>
                    <h5 className="text-lg font-bold text-slate-900">Verification Information</h5>
                  </div>
                  
                  <div className="bg-white/70 backdrop-blur-sm p-4 rounded-xl border border-emerald-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <p className="text-sm font-medium text-slate-700">Blockchain verified</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                        <p className="text-sm font-medium text-slate-700">IPFS encrypted storage</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <p className="text-sm font-medium text-slate-700">Tamper-proof record</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                        <p className="text-sm font-medium text-slate-700">Permanently archived</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-emerald-100">
                      <p className="text-xs text-slate-500 font-mono">
                        Certificate generated: {new Date().toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="bg-white/90 backdrop-blur-md shadow-2xl rounded-3xl p-8 border border-white/30">
              <div className="flex items-center space-x-4 mb-6">
                <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
                  <DocumentTextIcon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Certificate Actions</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={handleGenerateCertificate}
                  disabled={isGenerating}
                  className="group bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-2xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <div className="p-2 bg-white/20 rounded-xl group-hover:bg-white/30 transition-colors">
                    {isGenerating ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <ArrowDownTrayIcon className="h-5 w-5" />
                    )}
                  </div>
                  <span className="font-semibold">{isGenerating ? 'Generating...' : 'Download PDF'}</span>
                </button>
                
                <a
                  href={certificateInfo.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-4 rounded-2xl hover:from-purple-700 hover:to-purple-800 transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  <div className="p-2 bg-white/20 rounded-xl group-hover:bg-white/30 transition-colors">
                    <GlobeAltIcon className="h-5 w-5" />
                  </div>
                  <span className="font-semibold">View Explorer</span>
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </a>
                
                <Link href={`/verify?tx=${certificateInfo.transactionHash}`}>
                  <button className="group bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-6 py-4 rounded-2xl hover:from-emerald-700 hover:to-emerald-800 transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:-translate-y-1 w-full">
                    <div className="p-2 bg-white/20 rounded-xl group-hover:bg-white/30 transition-colors">
                      <CheckCircleIcon className="h-5 w-5" />
                    </div>
                    <span className="font-semibold">Verify Report</span>
                  </button>
                </Link>
              </div>
            </div>
            
            {/* Legal Notice */}
            <div className="mt-8 p-6 bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 rounded-2xl border-2 border-slate-200 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-slate-100 rounded-xl">
                  <ExclamationTriangleIcon className="h-5 w-5 text-slate-600" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">Legal Notice</h4>
              </div>
              
              <div className="bg-white/70 backdrop-blur-sm p-4 rounded-xl border border-slate-100">
                <p className="text-sm text-slate-700 leading-relaxed">
                  This certificate is generated automatically based on <span className="font-semibold text-slate-900">blockchain data</span> and serves as proof of 
                  report submission. The authenticity of this certificate can be verified by checking the 
                  transaction hash on the respective blockchain explorer. This document does not constitute 
                  <span className="font-semibold text-slate-900">legal advice</span> and should be used for verification purposes only.
                </p>
                
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-xs text-slate-500 font-mono">
                    Generated by GBV Reporting Platform • Powered by Blockchain Technology
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}