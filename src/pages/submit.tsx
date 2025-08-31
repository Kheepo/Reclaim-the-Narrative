/**
 * Submit page with report form and file upload
 */

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import OptimizedImage from '../components/OptimizedImage';
import {
  DocumentPlusIcon,
  DocumentIcon,
  PaperClipIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  LockClosedIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  CloudArrowUpIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import WalletConnection, { useWalletConnection } from '../components/WalletConnection';
import { useWallet } from '../hooks/useWallet';
import { submitReport, estimateSubmitReportGas } from '../lib/blockchain';
import { uploadEncryptedDataToIPFS } from '../lib/ipfs';
import { encryptWithPassword, generateHash, generateFileHash } from '../lib/encryption';
import { saveDraft, fileToBase64, DraftReport } from '../lib/storage';
import { generateCertificate, downloadCertificate, createCertificateData } from '../lib/certificate';
import { LoadingSpinner, LoadingButton, ProgressBar, LoadingOverlay } from '../components/Loading';
import { FadeIn, StatusCard, AnimatedIcon, StaggeredAnimation } from '../components/Animations';
import { useToastHelpers } from '../components/Toast';
import Web3StorageSetup from '../components/Web3StorageSetup';
import { checkWeb3StorageStatus } from '../lib/ipfs';

// Enhanced utilities
import { 
  validateFormData, 
  validateFile, 
  validateFiles, 
  validateTextSecurity, 
  validateNetworkConnectivity,
  validateBrowserCompatibility,
  validatePasswordStrength,
  sanitizeText,
  formatFileSize
} from '../lib/validation';
import { 
  createEnhancedError, 
  retryWithBackoff, 
  retryWithExponentialBackoff,
  withTimeout, 
  withAdaptiveTimeout,
  withEnhancedTimeout,
  handleComponentError, 
  categorizeError,
  ErrorCategory,
  CircuitBreaker,
  EnhancedError
} from '../lib/error-handling';
import { 
  checkConnectivity, 
  robustFetch, 
  NetworkMonitor
} from '../lib/network-utils';
import { 
  isWalletAvailable, 
  connectWallet, 
  switchNetwork, 
  getCurrentWalletInfo, 
  estimateGas
} from '../lib/wallet-utils';
import { 
  uploadToIPFS, 
  calculateFileHash,
  compressFile,
  IPFSUploadOptions,
  IPFSUploadResult
} from '../lib/enhanced-ipfs';
import { 
  SubmissionManager, 
  SessionManager, 
  FormStateManager
} from '../lib/state-management';
import { 
  RateLimiter, 
  CSRFProtection, 
  InputSanitizer, 
  BrowserSecurityChecker
} from '../lib/security-utils';

interface ReportForm {
  title: string;
  description: string;
  category: string;
  location: string;
  dateTime: string;
  additionalInfo: string;
}

interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  preview?: string;
}

const CATEGORIES = [
  'Physical Violence',
  'Sexual Violence',
  'Emotional/Psychological Abuse',
  'Economic Abuse',
  'Stalking/Harassment',
  'Digital/Cyber Abuse',
  'Other'
];

export default function SubmitPage() {
  const router = useRouter();
  const { isConnected, address } = useWalletConnection();
  const { getSigner } = useWallet();
  const { success, error, info } = useToastHelpers();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<ReportForm>({
    title: '',
    description: '',
    category: '',
    location: '',
    dateTime: '',
    additionalInfo: ''
  });
  
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState('');
  const [submitStatus, setSubmitStatus] = useState<{
    step: string;
    message: string;
    type: 'info' | 'success' | 'error';
  } | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentOperation, setCurrentOperation] = useState<string>('');
  const [web3StorageStatus, setWeb3StorageStatus] = useState<{
    configured: boolean;
    hasSpaces: boolean;
    currentSpace?: string;
  } | null>(null);
  const [isCheckingWeb3Storage, setIsCheckingWeb3Storage] = useState(false);
  
  // Enhanced utilities initialization (client-side only)
  const submissionManager = useRef<SubmissionManager | null>(null);
  const sessionManager = useRef<SessionManager | null>(null);
  const formStateManager = useRef<FormStateManager | null>(null);
  const rateLimiter = useRef<RateLimiter | null>(null);
  const csrfProtection = useRef<CSRFProtection | null>(null);
  const inputSanitizer = useRef<InputSanitizer | null>(null);
  const browserSecurityChecker = useRef<BrowserSecurityChecker | null>(null);
  const networkMonitor = useRef<NetworkMonitor | null>(null);

  // Enhanced state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [securityChecks, setSecurityChecks] = useState<{passed: boolean, issues: string[]}>({passed: true, issues: []});
  const [realTimeValidation, setRealTimeValidation] = useState<boolean>(true);
  const [csrfToken, setCsrfToken] = useState<string>('');
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  
  const steps = [
    { id: 1, name: 'Report Details', icon: DocumentTextIcon },
    { id: 2, name: 'Evidence Upload', icon: CloudArrowUpIcon },
    { id: 3, name: 'Security Settings', icon: LockClosedIcon },
    { id: 4, name: 'Review & Submit', icon: CheckCircleIcon }
  ];

  // Check web3.storage status on component mount
  useEffect(() => {
    checkWeb3StorageStatusAsync();
  }, []);

  // Initialize enhanced utilities and security checks (client-side only)
  useEffect(() => {
    const initializeEnhancedFeatures = async () => {
      try {
        // Initialize utilities only on client side
        if (typeof window !== 'undefined') {
          submissionManager.current = new SubmissionManager('submit-page');
          sessionManager.current = new SessionManager('submit-page');
          formStateManager.current = new FormStateManager('submit-page');
          rateLimiter.current = new RateLimiter({
            windowMs: 5 * 60 * 1000, // 5 minutes
            maxRequests: 3, // 3 submissions per 5 minutes
            keyGenerator: (identifier) => `submission:${identifier}`
          });
          csrfProtection.current = new CSRFProtection();
          inputSanitizer.current = InputSanitizer;
          browserSecurityChecker.current = BrowserSecurityChecker;
          networkMonitor.current = new NetworkMonitor();

          // Initialize CSRF protection
          const token = csrfProtection.current.generateToken('default-session');
          setCsrfToken(token);

          // Check browser security features
          const securityCheck = BrowserSecurityChecker.checkSecurityFeatures();
          setSecurityChecks({
            passed: securityCheck.supported,
            issues: securityCheck.missing
          });

          // Initialize network monitoring
          networkMonitor.current.addListener((status) => {
            setNetworkStatus(status.isOnline ? 'online' : 'offline');
          });
          networkMonitor.current.startPeriodicCheck();

          // Check initial network connectivity
          const connectivity = await checkConnectivity();
          setNetworkStatus(connectivity.isConnected ? 'online' : 'offline');

          // Auto-save form data periodically
          const autoSaveInterval = setInterval(() => {
            if ((formData.title || formData.description)) {
              // Auto-save to localStorage
              try {
                localStorage.setItem('submit-form-data', JSON.stringify({
                  ...formData,
                  encryptionPassword: '', // Don't save password
                  files: files.map(f => ({ id: f.id, name: f.name, size: f.size, type: f.type }))
                }));
              } catch (error) {
                console.warn('Failed to auto-save form data:', error);
              }
            }
          }, 30000); // Auto-save every 30 seconds

          return () => {
            clearInterval(autoSaveInterval);
            if (networkMonitor.current) {
              networkMonitor.current.stopPeriodicCheck();
              networkMonitor.current.destroy();
            }
          };
        }
      } catch (error) {
        console.error('Failed to initialize enhanced features:', error);
      }
    };

    initializeEnhancedFeatures();
  }, []);

  // Load saved form data on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedData = localStorage.getItem('submit-form-data');
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          setFormData(prev => ({ ...prev, ...parsedData, encryptionPassword: '' }));
        }
      } catch (error) {
        console.warn('Failed to load saved form data:', error);
      }
    }
  }, []);

  // Function to check web3.storage status
  const checkWeb3StorageStatusAsync = async () => {
    setIsCheckingWeb3Storage(true);
    try {
      console.debug('[Submit] Checking Web3.Storage status async');
      const status = await checkWeb3StorageStatus();
      console.debug('[Submit] Web3.Storage status result:', status);
      setWeb3StorageStatus(status);
    } catch (error) {
      console.error('[Submit] Error checking Web3.Storage status:', error);
      setWeb3StorageStatus({ configured: false, hasSpaces: false });
    } finally {
      setIsCheckingWeb3Storage(false);
    }
  };

  // Handle web3.storage setup completion
  const handleWeb3StorageSetupComplete = async () => {
    console.debug('[Submit] Web3.Storage setup completed callback triggered');
    try {
      // Re-check the status to ensure it's properly updated
      const status = await checkWeb3StorageStatus()
      console.debug('[Submit] Status after setup completion:', status);
      setWeb3StorageStatus(status)
      
      // If setup is complete, show success message but don't redirect
      if (status.configured && status.hasSpaces) {
        console.debug('[Submit] Web3.Storage is fully configured - staying on current step');
        // User can manually proceed when ready
      }
    } catch (error) {
      console.error('[Submit] Error in setup completion callback:', error)
    }
  };

  // Wizard navigation functions
  const nextStep = () => {
    console.debug('[Submit] nextStep called, current step:', currentStep);
    if (currentStep < totalSteps) {
      console.debug('[Submit] Moving to step:', currentStep + 1);
      setCurrentStep(currentStep + 1);
    } else {
      console.debug('[Submit] Already at last step:', currentStep);
    }
  };
  
  const prevStep = () => {
    if (currentStep > 1) {
      const newStep = currentStep - 1;
      console.debug('[Submit] prevStep called, moving from step', currentStep, 'to step', newStep);
      setCurrentStep(newStep);
    }
  };
  
  const goToStep = (step: number) => {
    console.debug('[Submit] goToStep called, moving from step', currentStep, 'to step', step);
    setCurrentStep(step);
  };
  
  // Validate current step
  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return formData.title && formData.category && formData.description;
      case 2:
        return true; // File upload is optional
      case 3:
        // Allow users to stay on step 3 even if Web3.Storage is not configured yet
        // They need to be on this step to configure it
        return true;
      case 4:
        // Only validate Web3.Storage and encryption for final submission
        return isConnected && address && encryptionPassword && encryptionPassword.length >= 8 && 
               web3StorageStatus?.configured && web3StorageStatus?.hasSpaces;
      default:
        return false;
    }
  };

  // Handle form input changes with enhanced validation
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    try {
      // Sanitize input
      const sanitizedValue = InputSanitizer.sanitizeText(value);
      
      // Real-time validation
      if (realTimeValidation) {
        const errors = { ...validationErrors };
        
        // Validate text security
        const securityValidation = validateTextSecurity(sanitizedValue);
        if (!securityValidation.isValid) {
          errors[name] = securityValidation.errors.join(', ');
        } else {
          delete errors[name];
        }
        
        // Field-specific validation
        switch (name) {
          case 'title':
            if (!sanitizedValue.trim()) {
              errors[name] = 'Title is required';
            } else if (sanitizedValue.length < 3) {
              errors[name] = 'Title must be at least 3 characters';
            } else if (sanitizedValue.length > 200) {
              errors[name] = 'Title must be less than 200 characters';
            }
            break;
          case 'description':
            if (!sanitizedValue.trim()) {
              errors[name] = 'Description is required';
            } else if (sanitizedValue.length < 10) {
              errors[name] = 'Description must be at least 10 characters';
            } else if (sanitizedValue.length > 5000) {
              errors[name] = 'Description must be less than 5000 characters';
            }
            break;
          case 'category':
            if (!sanitizedValue) {
              errors[name] = 'Category is required';
            }
            break;
        }
        
        setValidationErrors(errors);
      }
      
      // Update form data
      setFormData(prev => ({ ...prev, [name]: sanitizedValue }));
      
      // Mark form as dirty
      formStateManager.current?.touchField(name);
      
    } catch (err) {
      console.error('Error handling input change:', err);
      error('Invalid input detected');
    }
  };

  // Handle file upload with enhanced validation
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    try {
      // Check rate limiting
      if (!rateLimiter.current?.isAllowed('fileUpload')) {
        error('Too many file uploads. Please wait before uploading more files.');
        return;
      }

      // Validate all files first
      const fileValidationOptions = {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/*'],
        maxFiles: 10
      };

      const filesValidation = validateFiles(selectedFiles, fileValidationOptions);
      if (!filesValidation.isValid) {
        error(filesValidation.errors.join('\n'));
        return;
      }

      // Process each file
      for (const file of selectedFiles) {
        try {
          // Individual file validation
          const fileValidation = validateFile(file, fileValidationOptions);
          if (!fileValidation.isValid) {
            error(`${file.name}: ${fileValidation.errors.join(', ')}`);
            continue;
          }

          // Security scan
          const securityIssues = InputSanitizer.validateFileUpload(file);
          if (securityIssues.length > 0) {
            error(`${file.name}: ${securityIssues.join(', ')}`);
            continue;
          }

          const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const uploadedFile: UploadedFile = {
            id: fileId,
            file,
            name: file.name,
            size: file.size,
            type: file.type
          };

          // Create preview for images
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
              setFiles(prev => prev.map(f => 
                f.id === fileId ? { ...f, preview: e.target?.result as string } : f
              ));
            };
            reader.readAsDataURL(file);
          }

          setFiles(prev => {
            // Check for duplicate files
            const existingFile = prev.find(f => f.name === file.name && f.size === file.size);
            if (existingFile) {
              info(`File ${file.name} already exists`);
              return prev;
            }
            return [...prev, uploadedFile];
          });

          success(`File ${file.name} uploaded successfully`);
        } catch (fileError) {
          console.error(`Error processing file ${file.name}:`, fileError);
          error(`Failed to process file ${file.name}`);
        }
      }
    } catch (uploadError) {
      console.error('Error handling file upload:', uploadError);
      error('Failed to upload files. Please try again.');
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove file
  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Save as draft
  const saveDraftReport = async () => {
    try {
      const draftFiles = await Promise.all(
        files.map(async (file) => ({
          id: file.id,
          name: file.name,
          type: file.type,
          size: file.size,
          data: await fileToBase64(file.file),
          encrypted: !!encryptionPassword
        }))
      );
      
      const draft: Omit<DraftReport, 'id' | 'createdAt' | 'updatedAt' | 'encrypted'> = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        files: draftFiles
      };
      
      await saveDraft(draft, encryptionPassword || undefined);
      alert('Draft saved successfully!');
    } catch (error) {
      console.error('Failed to save draft:', error);
      alert('Failed to save draft. Please try again.');
    }
  };

  // Enhanced form validation
  const validateForm = async () => {
    try {
      // Check rate limiting for form submission
      if (!rateLimiter.current?.isAllowed('submission')) {
        error('Too many submission attempts. Please wait before trying again.');
        return false;
      }

      // Validate CSRF token
      if (!csrfProtection.current?.validateToken('submit-session', csrfToken)) {
        error('Security validation failed. Please refresh the page.');
        return false;
      }

      // Check network connectivity
      if (networkStatus === 'offline') {
        error('No internet connection. Please check your network and try again.');
        return false;
      }

      // Comprehensive form validation
      const formValidationOptions = {
        requireTitle: true,
        requireDescription: true,
        requireCategory: true,
        minPasswordLength: 8,
        maxTitleLength: 200,
        maxDescriptionLength: 5000
      };

      const validation = validateFormData({
        title: formData.title,
        description: formData.description,
        category: formData.category,
        encryptionPassword
      }, formValidationOptions);

      if (!validation.isValid) {
        error(validation.errors.join('\n'));
        return false;
      }

      // Validate files if any
      if (files.length > 0) {
        const fileValidationOptions = {
          maxSize: 10 * 1024 * 1024,
          allowedTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/*'],
          maxFiles: 10
        };

        const filesValidation = validateFiles(files.map(f => f.file), fileValidationOptions);
        if (!filesValidation.isValid) {
          error(`File validation failed: ${filesValidation.errors.join(', ')}`);
          return false;
        }
      }

      // Check browser compatibility
      const browserCheck = validateBrowserCompatibility();
      if (!browserCheck.isValid) {
        error(`Browser compatibility issues: ${browserCheck.errors.join(', ')}`);
        return false;
      }

      // Validate wallet connection
      if (!isConnected || !address) {
        error('Please connect your wallet to submit a report.');
        return false;
      }

      // Check wallet availability and network
      const walletInfo = await getCurrentWalletInfo();
      if (!walletInfo || !walletInfo.isConnected) {
        error('Wallet connection lost. Please reconnect your wallet.');
        return false;
      }

      // Check sufficient balance for gas
      // Check if wallet has sufficient balance (simplified check)
        const balance = parseFloat(walletInfo.balance);
        const hasBalance = balance > 0.001; // Minimum ETH for gas
      if (!hasBalance) {
        error('Insufficient balance for transaction fees. Please add funds to your wallet.');
        return false;
      }

      return true;
    } catch (validationError) {
      console.error('Form validation error:', validationError);
      error('Validation failed. Please try again.');
      return false;
    }
  };

  // Circuit breaker for submission failures
  const submissionCircuitBreaker = useRef<CircuitBreaker | null>(null);
  
  // Initialize circuit breaker
  useEffect(() => {
    if (typeof window !== 'undefined') {
      submissionCircuitBreaker.current = new CircuitBreaker(
        3,      // failureThreshold
        60000   // recoveryTimeout (1 minute)
      );
    }
  }, []);

  // Enhanced submit report with comprehensive error handling and retry mechanisms
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submissions
    if (submissionManager.current?.getState().isSubmitting) {
      error('Submission already in progress. Please wait.');
      return;
    }

    // Check circuit breaker state
    if (submissionCircuitBreaker.current && submissionCircuitBreaker.current.getState().state === 'OPEN') {
      error('Service temporarily unavailable due to repeated failures. Please try again later.');
      return;
    }

    // Validate form before proceeding
    const isValid = await validateForm();
    if (!isValid) return;
    
    // Start submission process
    submissionManager.current?.startSubmission();
    setIsSubmitting(true);
    setSubmitStatus({ step: 'Preparing', message: 'Preparing report data...', type: 'info' });
    setUploadProgress(0);
    
    try {
      // Enhanced network connectivity checks with multiple endpoints
      setCurrentOperation('Checking network connectivity...');
      const connectivityResults = await Promise.allSettled([
        checkConnectivity(),
        robustFetch('https://api.github.com'),
        robustFetch('https://ipfs.io')
      ]);
      
      const successfulChecks = connectivityResults.filter(result => result.status === 'fulfilled').length;
      if (successfulChecks === 0) {
        throw createEnhancedError(
          'Complete network connectivity failure',
          ErrorCategory.NETWORK,
          { 
            operation: 'network_connectivity_check',
            additionalData: {
              retryable: true, 
              userMessage: 'No internet connection detected. Please check your network and try again.',
              recoveryActions: [{ type: 'check_network', description: 'Check your internet connection' }]
            }
          }
        );
      } else if (successfulChecks < 2) {
        info('Limited network connectivity detected. Proceeding with caution.');
      }

      // Prepare report data with enhanced validation
      setCurrentOperation('Preparing report data...');
      setUploadProgress(10);
      
      const reportData = {
        ...formData,
        submissionDate: new Date().toISOString(),
        files: files.map(f => ({
          name: f.name,
          size: f.size,
          type: f.type,
          hash: '' // Will be filled during processing
        }))
      };
      
      // Validate encryption password strength
      const passwordValidation = validatePasswordStrength(encryptionPassword);
      if (!passwordValidation.isValid) {
        throw createEnhancedError(
          'Weak encryption password',
          ErrorCategory.VALIDATION,
          { 
            operation: 'password-validation',
            additionalData: { 
              userMessage: `Password requirements: ${passwordValidation.errors.join(', ')}`,
              validationErrors: passwordValidation.errors
            }
          }
        );
      }

      setSubmitStatus({ step: 'Encrypting', message: 'Encrypting report data...', type: 'info' });
      setCurrentOperation('Encrypting report data...');
      setUploadProgress(20);
      
      // Encrypt report data with timeout
      const encryptedData = await withTimeout(
        encryptWithPassword(JSON.stringify(reportData), encryptionPassword),
        30000, // 30 seconds timeout
        'Encryption timeout'
      );
      
      // Process files with enhanced validation and hashing
      const fileHashes: string[] = [];
      const processedFiles: File[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const fileItem = files[i];
        setCurrentOperation(`Processing file ${i + 1} of ${files.length}...`);
        
        // Calculate file hash for integrity verification
        const fileHash = await calculateFileHash(fileItem.file);
        fileHashes.push(fileHash);
        
        // Update report data with file hash
        reportData.files[i].hash = fileHash;
        
        // Compress file if needed (for large files)
        const processedFile = await compressFile(fileItem.file);
        processedFiles.push(processedFile);
        
        setUploadProgress(20 + (i + 1) / files.length * 15);
      }
      
      info('Report data encrypted and files processed successfully');
      setUploadProgress(40);
      
      setSubmitStatus({ step: 'Uploading', message: 'Uploading to IPFS...', type: 'info' });
      setCurrentOperation('Uploading to IPFS...');
      
      // Enhanced IPFS upload with adaptive timeout and exponential backoff
      const baseUploadOptions: IPFSUploadOptions = {
        onProgress: (progressData) => {
          setUploadProgress(40 + progressData.progress * 0.2); // 40-60% for IPFS upload
        },
        timeout: 120000, // 2 minutes base timeout
        retryAttempts: 3
      };
      
      // Upload main report data with enhanced retry mechanism
      const encryptedDataBytes = Uint8Array.from(atob(encryptedData.encryptedData), c => c.charCodeAt(0));
      const encryptedDataFile = new File([encryptedDataBytes], `report-${Date.now()}.json`, { type: 'application/json' });
      const mainUploadResult = await retryWithExponentialBackoff(
        async () => {
          return await withAdaptiveTimeout(
            uploadToIPFS(
              encryptedDataFile,
              baseUploadOptions
            ),
            networkStatus === 'online' ? 120000 : 180000 // Adaptive timeout based on network
          );
        },
        {
          maxAttempts: 5,
          baseDelay: 2000,
          maxDelay: 30000,
          shouldRetry: (error) => {
            // Retry on network errors, timeouts, and IPFS service issues
            return error.message.includes('timeout') || 
                   error.message.includes('network') ||
                   error.message.includes('IPFS') ||
                   error.message.includes('gateway');
          },
          onRetry: (attempt, error) => {
            info(`Retrying IPFS upload (attempt ${attempt}): ${error.message}`);
            setCurrentOperation(`Retrying IPFS upload (attempt ${attempt})...`);
          }
        }
      );
      
      // Upload files with enhanced error handling and progress tracking
      const fileUploadResults: IPFSUploadResult[] = [];
      if (processedFiles.length > 0) {
        for (let i = 0; i < processedFiles.length; i++) {
          const file = processedFiles[i];
          try {
            const uploadResult = await retryWithExponentialBackoff(
              async () => {
                const { promise } = withEnhancedTimeout(
                  uploadToIPFS(
                    file,
                    {
                      ...baseUploadOptions,
                      onProgress: (progressData) => {
                        const fileProgress = (i + progressData.progress / 100) / processedFiles.length;
                        setUploadProgress(40 + fileProgress * 0.2);
                      }
                    }
                  ),
                  {
                    timeoutMs: networkStatus === 'online' ? 180000 : 240000,
                    operation: `Uploading file ${file.name}`,
                    onProgress: (elapsed, remaining) => {
                      const progress = elapsed / (elapsed + remaining);
                      setCurrentOperation(`Uploading ${file.name} (${Math.round(progress * 100)}%)...`);
                    }
                  }
                );
                return await promise;
              },
              {
                maxAttempts: 3,
                baseDelay: 3000,
                maxDelay: 20000,
                shouldRetry: (error) => {
                  return error.message.includes('timeout') || 
                         error.message.includes('network') ||
                         error.message.includes('IPFS');
                },
                onRetry: (attempt, error) => {
                  info(`Retrying file upload ${file.name} (attempt ${attempt}): ${error.message}`);
                }
              }
            );
            fileUploadResults.push(uploadResult);
          } catch (fileError) {
            console.error(`Failed to upload file ${file.name}:`, fileError);
            // Continue with other files but log the failure
            error(`Failed to upload file ${file.name}. Continuing with other files.`);
          }
        }
      }
      
      const ipfsHash = mainUploadResult.hash;
      const allHashes = [ipfsHash, ...fileUploadResults.map(r => r.hash)];
      
      info('Data uploaded to IPFS successfully');
      setUploadProgress(60);
      
      setSubmitStatus({ step: 'Hashing', message: 'Generating report hash...', type: 'info' });
      setCurrentOperation('Generating report hash...');
      
      // Generate report hash with file hashes included
      const finalReportData = {
        ...reportData,
        ipfsHashes: allHashes,
        fileHashes
      };
      const reportHash = await generateHash(JSON.stringify(finalReportData));
      
      setSubmitStatus({ step: 'Blockchain', message: 'Submitting to blockchain...', type: 'info' });
      setCurrentOperation('Submitting to blockchain...');
      setUploadProgress(80);
      
      // Enhanced wallet connection with retry and network validation
      setSubmitStatus({ step: 'Connecting to wallet...', message: 'Please approve the connection in your wallet', type: 'info' });
      
      const walletConnection = await retryWithExponentialBackoff(
        async () => {
          try {
            // Check if wallet is available
            if (!window.ethereum) {
              throw createEnhancedError(
                'No wallet detected',
                ErrorCategory.WALLET,
                { 
                  operation: 'wallet-detection',
                  additionalData: { userMessage: 'Please install MetaMask or another Web3 wallet' }
                }
              );
            }
            
            // Verify network connectivity
            const networkCheck = await checkConnectivity();
            if (!networkCheck.isConnected) {
              throw createEnhancedError(
                'Network connectivity required',
                ErrorCategory.NETWORK,
                { 
                  operation: 'network-check',
                  additionalData: { userMessage: 'Please check your internet connection' }
                }
              );
            }
            
            const signer = await getSigner();
            if (!signer) {
              throw createEnhancedError(
                'Failed to get wallet signer',
                ErrorCategory.WALLET,
                { 
                  operation: 'wallet-signer',
                  additionalData: { userMessage: 'Unable to connect to wallet. Please ensure it is unlocked.' }
                }
              );
            }
            
            // Verify network after connection
            const network = await signer.provider?.getNetwork();
            console.log('Connected to network:', network?.name, 'Chain ID:', network?.chainId);
            
            return signer;
          } catch (error) {
            // Enhanced error context for wallet issues
            if (error instanceof Error) {
              if (error.message.includes('User rejected') || error.message.includes('User denied')) {
                throw createEnhancedError(
                  'User rejected wallet connection',
                  ErrorCategory.VALIDATION,
                  { 
                    operation: 'wallet-connection',
                    additionalData: { userMessage: 'Wallet connection was cancelled by user' }
                  }
                );
              }
              if (error.message.includes('network') || error.message.includes('connection')) {
                throw createEnhancedError(
                  'Network error during wallet connection',
                  ErrorCategory.NETWORK,
                  { 
                    operation: 'wallet-connection',
                    additionalData: { userMessage: 'Network issue detected. Please check your connection and try again.' }
                  }
                );
              }
            }
            throw error;
          }
        },
        { 
          maxAttempts: 3, 
          baseDelay: 1000,
          maxDelay: 5000,
          shouldRetry: (error) => {
            // Don't retry if user explicitly rejected or if it's a user action
            const enhancedError = error as any;
            if (enhancedError.category === ErrorCategory.VALIDATION) {
              return false;
            }
            // Retry for network and wallet errors
            return enhancedError.category === ErrorCategory.NETWORK || 
                   enhancedError.category === ErrorCategory.WALLET;
          },
          onRetry: (attempt, error) => {
            console.log(`Wallet connection attempt ${attempt} failed:`, error.message);
            setSubmitStatus({ 
              step: 'Retrying wallet connection...', 
              message: `Attempt ${attempt}/3 - Please check your wallet`, 
              type: 'info' 
            });
          }
        }
      );
      
      // Enhanced gas estimation with retry and network validation
      setSubmitStatus({ step: 'Estimating gas...', message: 'Calculating transaction costs', type: 'info' });
      
      const gasEstimate = await retryWithExponentialBackoff(
        async () => {
          try {
            if (!address) {
              throw createEnhancedError(
                'Wallet address not available',
                ErrorCategory.WALLET,
                { 
                  operation: 'gas-estimation',
                  additionalData: { userMessage: 'Please connect your wallet first.' }
                }
              );
            }
            const currentSigner = await getSigner();
            if (!currentSigner) {
              throw createEnhancedError(
                'Unable to get wallet signer',
                ErrorCategory.WALLET,
                { 
                  operation: 'gas-estimation',
                  additionalData: { userMessage: 'Please ensure your wallet is connected and unlocked.' }
                }
              );
            }
            const gasEstimate = await estimateSubmitReportGas(reportHash, allHashes, currentSigner);
            
            // Log gas estimate for debugging
            console.log('Gas estimate for report submission:', gasEstimate.toString());
            
            // Warn if gas estimate is unusually high (more than 500,000 gas)
            if (gasEstimate > BigInt(500000)) {
              console.warn('High gas estimate detected:', gasEstimate.toString());
              setSubmitStatus({ 
                step: 'High gas cost detected', 
                message: `Gas estimate: ${gasEstimate.toString()} units. Continue?`, 
                type: 'info' 
              });
            }
            
            return gasEstimate;
          } catch (error) {
            if (error instanceof Error) {
              if (error.message.includes('network') || error.message.includes('connection')) {
                throw createEnhancedError(
                  'Network error during gas estimation',
                  ErrorCategory.NETWORK,
                  { 
                    operation: 'gas-estimation',
                    additionalData: { userMessage: 'Unable to estimate gas costs. Please check your connection.' }
                  }
                );
              }
              if (error.message.includes('revert') || error.message.includes('execution')) {
                throw createEnhancedError(
                  'Transaction would fail',
                  ErrorCategory.BLOCKCHAIN,
                  { 
                    operation: 'gas-estimation',
                    additionalData: { userMessage: 'Transaction simulation failed. Please check your inputs.' }
                  }
                );
              }
            }
            throw error;
          }
        },
        {
          maxAttempts: 3,
          baseDelay: 2000,
          shouldRetry: (error) => {
            // Retry on network errors, but not on insufficient funds or validation errors
            const enhancedError = error as any;
            return enhancedError.category === ErrorCategory.NETWORK;
          },
          onRetry: (attempt, error) => {
            console.log(`Gas estimation attempt ${attempt} failed:`, error.message);
            setSubmitStatus({ 
              step: 'Retrying gas estimation...', 
              message: `Attempt ${attempt}/3`, 
              type: 'info' 
            });
          }
        }
      );
      
      // Enhanced blockchain submission with comprehensive error handling
      setSubmitStatus({ step: 'Submitting to blockchain...', message: 'Broadcasting transaction...', type: 'info' });
      
      const txResult = await retryWithExponentialBackoff(
        async () => {
          try {
            // Check network status before submission
            const networkCheck = await checkConnectivity();
            if (!networkCheck.isConnected) {
              throw createEnhancedError(
                'Network required for blockchain submission',
                ErrorCategory.NETWORK,
                { 
                  operation: 'blockchain-submission',
                  additionalData: { userMessage: 'Please check your internet connection before submitting.' }
                }
              );
            }
            
            // Verify wallet is still connected
            const currentSigner = await getSigner();
            if (!currentSigner) {
              throw createEnhancedError(
                'Wallet disconnected',
                ErrorCategory.WALLET,
                { 
                  operation: 'blockchain-submission',
                  additionalData: { userMessage: 'Wallet connection lost. Please reconnect and try again.' }
                }
              );
            }
            
            const result = await submitReport(reportHash, allHashes, walletConnection);
            
            // Validate transaction result
            if (!result || !result.hash) {
              throw createEnhancedError(
                'Invalid transaction result',
                ErrorCategory.BLOCKCHAIN,
                { 
                  operation: 'blockchain-submission',
                  additionalData: { userMessage: 'Transaction submission failed. Please try again.' }
                }
              );
            }
            
            return result;
          } catch (error) {
            if (error instanceof Error) {
              // Handle specific blockchain errors
              if (error.message.includes('user rejected') || error.message.includes('denied')) {
                throw createEnhancedError(
                  'Transaction rejected by user',
                  ErrorCategory.VALIDATION,
                  { 
                    operation: 'blockchain-submission',
                    additionalData: { userMessage: 'Transaction was cancelled by user.' }
                  }
                );
              }
              if (error.message.includes('insufficient funds')) {
                throw createEnhancedError(
                  'Insufficient funds',
                  ErrorCategory.WALLET,
                  { 
                    operation: 'blockchain-submission',
                    additionalData: {
                      userMessage: 'Insufficient funds for transaction. Please add funds to your wallet.',
                      recoveryActions: [{ type: 'fund_wallet', description: 'Add ETH to your wallet' }]
                    }
                  }
                );
              }
              if (error.message.includes('gas') && error.message.includes('limit')) {
                throw createEnhancedError(
                  'Gas limit exceeded',
                  ErrorCategory.BLOCKCHAIN,
                  { 
                    operation: 'blockchain-submission',
                    additionalData: {
                      userMessage: 'Transaction requires too much gas. Please try again later.',
                      recoveryActions: [{ type: 'retry_later', description: 'Wait for lower gas prices' }]
                    }
                  }
                );
              }
              if (error.message.includes('nonce')) {
                throw createEnhancedError(
                  'Transaction nonce error',
                  ErrorCategory.BLOCKCHAIN,
                  { 
                    operation: 'blockchain-submission',
                    additionalData: {
                      userMessage: 'Transaction ordering issue. Please refresh and try again.',
                      recoveryActions: [{ type: 'refresh', description: 'Refresh the page and retry' }]
                    }
                  }
                );
              }
              if (error.message.includes('network') || error.message.includes('connection')) {
                throw createEnhancedError(
                  'Network error during submission',
                  ErrorCategory.NETWORK,
                  { 
                    operation: 'blockchain-submission',
                    additionalData: { userMessage: 'Network issue detected. Please check your connection and try again.' }
                  }
                );
              }
            }
            throw error;
          }
        },
        { 
          maxAttempts: 3, 
          baseDelay: 2000,
          maxDelay: 10000,
          shouldRetry: (error) => {
            // Don't retry user actions or wallet issues
            const enhancedError = error as any;
            if (enhancedError.category === ErrorCategory.VALIDATION || 
                enhancedError.category === ErrorCategory.WALLET) {
              return false;
            }
            // Retry network and some blockchain errors
            return enhancedError.category === ErrorCategory.NETWORK || 
                   (enhancedError.category === ErrorCategory.BLOCKCHAIN && 
                    (error.message.includes('nonce') || error.message.includes('timeout')));
          },
          onRetry: (attempt, error) => {
            console.log(`Blockchain submission attempt ${attempt} failed:`, error.message);
            setSubmitStatus({ 
              step: 'Retrying blockchain submission...', 
              message: `Attempt ${attempt}/3 - ${error.message}`, 
              type: 'info' 
            });
          }
        }
      );
      
      const txHash = txResult.hash;
      setTransactionHash(txHash);
      
      info('Transaction submitted to blockchain successfully');
      setUploadProgress(90);
      
      setSubmitStatus({ 
        step: 'Success', 
        message: 'Report submitted successfully!', 
        type: 'success' 
      });
      
      // Circuit breaker will automatically record success since no error was thrown
      
      // Mark form as clean after successful submission
      if (formStateManager.current) {
        formStateManager.current.markAsSaved();
      }
      
      // Generate and download certificate with enhanced error handling
      setTimeout(async () => {
        try {
          setSubmitStatus({ 
            step: 'Certificate', 
            message: 'Generating certificate...', 
            type: 'info' 
          });
          setCurrentOperation('Generating certificate...');
          
          const certificateData = createCertificateData(
            `report-${Date.now()}`,
            txHash,
            0, // Block number will be filled when transaction is mined
            new Date().toISOString(),
            ipfsHash,
            reportHash
          );
          
          const certificateBlob = await withTimeout(
            generateCertificate(certificateData),
            30000,
            'Certificate generation timeout'
          );
          
          downloadCertificate(certificateBlob, `report-certificate-${Date.now()}.pdf`);
          
          setSubmitStatus({ 
            step: 'Complete', 
            message: 'Certificate downloaded successfully!', 
            type: 'success' 
          });
          setUploadProgress(100);
          
          success('Report submitted successfully! Certificate generated.');
          
          // Clear form data after successful submission
          setFormData({ 
            title: '', 
            description: '', 
            category: '',
            location: '',
            dateTime: '',
            additionalInfo: ''
          });
          setFiles([]);
          setEncryptionPassword('');
          
        } catch (certError) {
          console.error('Failed to generate certificate:', certError);
          const errorMessage = certError instanceof Error ? certError.message : 'Unknown error occurred';
          setSubmitStatus({ 
            step: 'Warning', 
            message: 'Report submitted but certificate generation failed.', 
            type: 'error' 
          });
          error(`Certificate generation failed: ${errorMessage}`);
        }
      }, 2000);
      
    } catch (err) {
      console.error('Failed to submit report:', err);
      
      // Circuit breaker automatically records failure when execute() throws
      
      const enhancedError = err instanceof Error && 'category' in err 
        ? err as EnhancedError
        : createEnhancedError(
            err instanceof Error ? err.message : 'Unknown error',
            ErrorCategory.UNKNOWN,
            { 
              operation: 'submission',
              additionalData: { userMessage: 'An unexpected error occurred during submission' }
            }
          );
      
      const userMessage = enhancedError.userMessage || enhancedError.message;
      const recoveryActions = enhancedError.recoveryActions || [];
      
      setSubmitStatus({ 
        step: 'Error', 
        message: userMessage, 
        type: 'error' 
      });
      
      // Enhanced error handling with automatic retry suggestions
      if (enhancedError.isRetryable) {
        const retryMessage = `${userMessage}\n\nThis error is retryable. Would you like to try again?`;
        
        // Show retry option for retryable errors
        setTimeout(() => {
          if (confirm(retryMessage)) {
            handleSubmit(e as any); // Retry submission
          }
        }, 2000);
      }
      
      // Show recovery actions if available
      if (recoveryActions.length > 0) {
        const actionMessages = recoveryActions.map(action => action.label).join(', ');
        error(`${userMessage}\n\nSuggested actions: ${actionMessages}`);
      } else {
        error(userMessage);
      }
      
      // Log detailed error for debugging and monitoring
      console.error('Enhanced error details:', {
        category: enhancedError.code,
        context: enhancedError.context,
        retryable: enhancedError.isRetryable,
        circuitBreakerState: submissionCircuitBreaker.current?.getState(),
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        networkStatus: networkStatus
      });
      
    } finally {
      submissionManager.current?.resetSubmission();
      setIsSubmitting(false);
      setCurrentOperation('');
      
      // Don't reset upload progress immediately to show final state
      setTimeout(() => {
        setUploadProgress(0);
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <Link href="/">
                <button className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors group">
                  <ArrowLeftIcon className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                  <span className="font-medium">Back to Home</span>
                </button>
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg">
                  <ShieldCheckIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    Submit Anonymous Report
                  </h1>
                  <p className="text-sm text-slate-600">Step {currentStep} of {totalSteps}</p>
                </div>
              </div>
            </div>
            
            <WalletConnection />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Indicator */}
        <FadeIn>
          <div className="mb-8">
            <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/20 p-6">
              <div className="flex items-center justify-between">
                <StaggeredAnimation>
                  {steps.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = currentStep === step.id;
                    const isCompleted = currentStep > step.id;
                    const isClickable = currentStep > step.id || (currentStep === step.id);
                    
                    return (
                      <div key={step.id} className="flex items-center">
                        <button
                          onClick={() => isClickable && goToStep(step.id)}
                          disabled={!isClickable}
                          className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                            isActive
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg scale-105'
                              : isCompleted
                              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md hover:shadow-lg'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          } ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                        >
                          <div className={`p-2 rounded-lg ${
                            isActive || isCompleted ? 'bg-white/20' : 'bg-white/50'
                          }`}>
                            {isCompleted ? (
                              <AnimatedIcon type="success" className="h-5 w-5" />
                            ) : (
                              <Icon className="h-5 w-5" />
                            )}
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-sm">{step.name}</div>
                            <div className="text-xs opacity-75">
                              {isCompleted ? 'Completed' : isActive ? 'Current' : 'Pending'}
                            </div>
                          </div>
                        </button>
                        {index < steps.length - 1 && (
                          <ChevronRightIcon className={`h-5 w-5 mx-4 transition-colors duration-300 ${
                            currentStep > step.id ? 'text-green-500' : 'text-slate-300'
                          }`} />
                        )}
                      </div>
                    );
                  })}
                </StaggeredAnimation>
              </div>
            </div>
          </div>
        </FadeIn>
        
        {/* Security Notice */}
        <FadeIn delay={200}>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-xl p-6 mb-8 shadow-sm">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShieldCheckIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Secure & Anonymous Submission</h3>
                <p className="text-blue-800 leading-relaxed">
                  All data is encrypted locally before transmission. Your identity and personal information are never stored on our servers. 
                  Reports are secured using blockchain technology for immutable evidence preservation.
                </p>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Wizard Content */}
        <FadeIn delay={400}>
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 overflow-hidden relative">
            {/* Loading Overlay */}
            {isSubmitting && (
              <LoadingOverlay isVisible={isSubmitting}>
                <div className="text-center space-y-4">
                  <LoadingSpinner size="lg" />
                  <div className="space-y-2">
                    <p className="text-lg font-semibold text-white">{currentOperation}</p>
                    <ProgressBar progress={uploadProgress} className="w-64" />
                    <p className="text-sm text-white/80">{uploadProgress}% Complete</p>
                  </div>
                </div>
              </LoadingOverlay>
            )}
            
            <form onSubmit={handleSubmit}>
            {/* Step 1: Report Details */}
            {currentStep === 1 && (
              <FadeIn>
                <div className="p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Report Information</h2>
                  <p className="text-slate-600">Provide details about the incident you&apos;re reporting</p>
                </div>
            
                <div className="grid grid-cols-1 gap-8">
                  <div>
                    <label htmlFor="title" className="block text-sm font-semibold text-slate-700 mb-3">
                      Report Title *
                    </label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                      placeholder="Brief title describing the incident"
                      required
                    />
                  </div>
              
                  <div>
                    <label htmlFor="category" className="block text-sm font-semibold text-slate-700 mb-3">
                      Category *
                    </label>
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                      required
                    >
                      <option value="">Select a category</option>
                      {CATEGORIES.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
              
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="location" className="block text-sm font-semibold text-slate-700 mb-3">
                        Location (Optional)
                      </label>
                      <input
                        type="text"
                        id="location"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                        placeholder="General location (city, area)"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="dateTime" className="block text-sm font-semibold text-slate-700 mb-3">
                        Date &amp; Time (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        id="dateTime"
                        name="dateTime"
                        value={formData.dateTime}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                      />
                    </div>
                  </div>
              
                  <div>
                    <label htmlFor="description" className="block text-sm font-semibold text-slate-700 mb-3">
                      Incident Description *
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      rows={6}
                      value={formData.description}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50 backdrop-blur-sm resize-none"
                      placeholder="Provide a detailed description of the incident..."
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="additionalInfo" className="block text-sm font-semibold text-slate-700 mb-3">
                      Additional Information (Optional)
                    </label>
                    <textarea
                      id="additionalInfo"
                      name="additionalInfo"
                      rows={4}
                      value={formData.additionalInfo}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50 backdrop-blur-sm resize-none"
                      placeholder="Any additional context or information..."
                    />
                  </div>
                </div>
                </div>
              </FadeIn>
            )}

            {/* Step 2: Evidence Upload */}
            {currentStep === 2 && (
              <FadeIn>
                <div className="p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Evidence Upload</h2>
                  <p className="text-slate-600">
                    Upload any supporting documents, images, or other evidence. All files are encrypted before storage.
                  </p>
                </div>
            
                <div 
                  className="border-2 border-dashed border-blue-300 rounded-xl p-8 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 hover:border-blue-400 transition-all duration-200 cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="text-center">
                    <CloudArrowUpIcon className="mx-auto h-16 w-16 text-blue-400 group-hover:text-blue-500 transition-colors duration-200" />
                    <div className="mt-6">
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <span className="text-lg font-semibold text-slate-700 group-hover:text-blue-600 transition-colors duration-200">
                          Drag and drop files here, or click to select
                        </span>
                        <span className="mt-2 block text-sm text-slate-500">
                          Images, documents, audio, or video files (max 10MB each)
                        </span>
                      </label>
                      <input
                        ref={fileInputRef}
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        multiple
                        onChange={handleFileUpload}
                        accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
                      />
                    </div>
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                      >
                        <PaperClipIcon className="h-5 w-5 mr-2" />
                        Choose Files
                      </button>
                    </div>
                  </div>
                </div>
            
                {/* Uploaded Files */}
                {files.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Uploaded Files ({files.length})</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {files.map(file => (
                        <div key={file.id} className="relative group bg-white/70 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 p-4">
                          <div className="flex items-start space-x-3">
                            {file.preview ? (
                              <div className="flex-shrink-0">
                                <OptimizedImage
                                  src={file.preview}
                                  alt={`Preview of ${file.name}`}
                                  fill
                                  sizes="(max-width: 640px) 48px, (max-width: 1024px) 40px, 48px"
                                  className="object-cover rounded-lg h-12 w-12 sm:h-10 sm:w-10 lg:h-12 lg:w-12"
                                  aspectRatio="square"
                                  quality={60}
                                  fallbackIcon={true}
                                />
                              </div>
                            ) : (
                              <div className="flex-shrink-0 h-12 w-12 sm:h-10 sm:w-10 lg:h-12 lg:w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <DocumentIcon className="h-6 w-6 text-blue-500" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800 truncate" title={file.name}>
                                {file.name}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(file.id)}
                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                            title="Remove file"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              </FadeIn>
            )}

            {/* Step 3: Security Settings */}
            {currentStep === 3 && (
              <FadeIn>
                <div className="p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Security Settings</h2>
                  <p className="text-slate-600">
                    Configure encryption and IPFS storage settings for your report.
                  </p>
                </div>
                
                {/* Web3.Storage Setup */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">IPFS Storage Configuration</h3>
                  <Web3StorageSetup onSetupComplete={handleWeb3StorageSetupComplete} />
                </div>
                
                {/* Encryption Password */}
                <div>
                  <label htmlFor="encryptionPassword" className="block text-sm font-semibold text-slate-700 mb-3">
                    Encryption Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="encryptionPassword"
                      value={encryptionPassword}
                      onChange={(e) => setEncryptionPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                      placeholder="Enter a strong password to encrypt your report"
                      required
                      minLength={8}
                      disabled={!web3StorageStatus?.configured || !web3StorageStatus?.hasSpaces}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors duration-200"
                      disabled={!web3StorageStatus?.configured || !web3StorageStatus?.hasSpaces}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    This password encrypts your report data. Keep it safe - it cannot be recovered if lost.
                  </p>
                  {(!web3StorageStatus?.configured || !web3StorageStatus?.hasSpaces) && (
                    <p className="mt-2 text-sm text-amber-600">
                      Please configure IPFS storage first before setting an encryption password.
                    </p>
                  )}
                </div>
                </div>
              </FadeIn>
            )}

            {/* Step 4: Review & Submit */}
            {currentStep === 4 && (
              <FadeIn>
                <div className="p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Review & Submit</h2>
                  <p className="text-slate-600">
                    Please review your report details before submitting to the blockchain.
                  </p>
                </div>
                
                {/* Review Summary */}
                <div className="bg-slate-50 rounded-xl p-6 mb-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Report Summary</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-slate-600">Title:</span>
                      <p className="text-slate-800">{formData.title || 'Not provided'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-600">Category:</span>
                      <p className="text-slate-800">{formData.category || 'Not selected'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-600">Files:</span>
                      <p className="text-slate-800">{files.length} file(s) attached</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-600">Encryption:</span>
                      <p className="text-slate-800">{encryptionPassword ? 'Password set' : 'No password set'}</p>
                    </div>
                  </div>
                </div>
                
                {/* Submit Actions */}
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={saveDraftReport}
                    className="inline-flex items-center px-6 py-3 border border-slate-300 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                  >
                    Save Draft
                  </button>
                  
                  <LoadingButton
                    type="submit"
                    isLoading={isSubmitting}
                    disabled={!isConnected || !address}
                    className="px-8 py-3 text-base font-medium bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl"
                  >
                    Submit Report
                  </LoadingButton>
                </div>
                </div>
              </FadeIn>
            )}
            
            {/* Navigation */}
            <div className="px-8 py-6 bg-slate-50 border-t border-slate-200">
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className="inline-flex items-center px-6 py-3 border border-slate-300 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <ChevronLeftIcon className="h-5 w-5 mr-2" />
                  Previous
                </button>
                
                {currentStep < totalSteps && (
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={!validateCurrentStep()}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    Next
                    <ChevronRightIcon className="h-5 w-5 ml-2" />
                  </button>
                )}
              </div>
            </div>
        </form>
        </div>
        </FadeIn>

        {/* Submit Status */}
        {submitStatus && (
          <FadeIn className="mt-8">
            <StatusCard
              type={submitStatus.type as 'success' | 'error' | 'warning' | 'info'}
              title={submitStatus.step}
              message={submitStatus.message}
              action={transactionHash ? {
                label: 'Verify Report',
                onClick: () => router.push(`/verify?tx=${transactionHash}`)
              } : undefined}
            />
            {transactionHash && (
              <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                <p className="text-sm font-medium text-slate-700 mb-2">Transaction Hash:</p>
                <p className="text-sm font-mono text-slate-900 break-all bg-white px-3 py-2 rounded-lg border">
                  {transactionHash}
                </p>
              </div>
            )}
          </FadeIn>
        )}
      </main>
    </div>
  );
}