import React, { useState, useEffect } from 'react'
import { setupWeb3Storage, createWeb3StorageSpace, checkWeb3StorageStatus } from '../lib/ipfs'

interface Web3StorageSetupProps {
  onSetupComplete?: () => void
}

type SetupStep = 'initial' | 'email-sent' | 'verifying' | 'verified' | 'creating-space' | 'completed'

export const Web3StorageSetup: React.FC<Web3StorageSetupProps> = ({ onSetupComplete }) => {
  const [email, setEmail] = useState('')
  const [spaceName, setSpaceName] = useState('GBV-Reporting-Platform')
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState<SetupStep>('initial')
  const [status, setStatus] = useState<{
    configured: boolean
    hasSpaces: boolean
    currentSpace?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [lastStatusCheck, setLastStatusCheck] = useState<Date | null>(null)

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    try {
      console.log('[Web3StorageSetup] Checking status...')
      setLastStatusCheck(new Date())
      const statusResult = await checkWeb3StorageStatus()
      const previousStatus = status
      setStatus(statusResult)
      
      // Update step based on status
      if (statusResult.configured && statusResult.hasSpaces) {
        setCurrentStep('completed')
        setError(null)
        setSuccess('✅ Web3.Storage is fully configured and ready to use!')
      } else if (statusResult.configured && !statusResult.hasSpaces) {
        setCurrentStep('verified')
        setError(null)
        setSuccess('✅ Email verified! Now you can create your storage space.')
      } else if (statusResult.error) {
        if (statusResult.error.includes('Email verification')) {
          if (currentStep === 'email-sent' || currentStep === 'verifying') {
            // Keep current step, just show the error
            setError('⏳ Email verification pending. Please check your email and click the verification link.')
          } else {
            setCurrentStep('initial')
            setError(statusResult.error)
          }
        } else {
          setError(`Status check failed: ${statusResult.error}`)
        }
      }
      
      // Call onSetupComplete when setup becomes fully complete
      if (statusResult.configured && statusResult.hasSpaces && onSetupComplete) {
        // Only call if this is a new completion (not already complete)
        if (!previousStatus?.configured || !previousStatus?.hasSpaces) {
          console.log('[Web3StorageSetup] Setup completed successfully!')
          onSetupComplete()
        }
      }
      
      console.log('[Web3StorageSetup] Status check result:', {
        configured: statusResult.configured,
        hasSpaces: statusResult.hasSpaces,
        currentStep,
        error: statusResult.error
      })
    } catch (error) {
      console.error('[Web3StorageSetup] Failed to check status:', error)
      setError('Failed to check Web3.Storage status. Please try again.')
    }
  }

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim() || !spaceName.trim()) {
      setError('❌ Please fill in all fields')
      return
    }

    // Validate email format on frontend as well
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError('❌ Please enter a valid email address')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)
    setCurrentStep('email-sent')

    try {
      console.log('[Web3StorageSetup] Starting setup process...')
      await setupWeb3Storage(email.trim(), spaceName.trim())
      
      setCurrentStep('verifying')
      setSuccess(
        '📧 Verification email sent successfully! Please check your email (including spam folder) and click the verification link.'
      )
      
      // Check status again after a delay to see if verification completed
      setTimeout(() => {
        console.log('[Web3StorageSetup] Auto-checking status after email sent...')
        checkStatus()
      }, 3000)
      
      // Don't call onSetupComplete here - only call it when setup is truly complete
    } catch (error) {
      console.error('[Web3StorageSetup] Setup failed:', error)
      setCurrentStep('initial')
      
      let errorMessage = 'Setup failed'
      if (error instanceof Error) {
        if (error.message.includes('already exists') || error.message.includes('already registered')) {
          errorMessage = '⚠️ This email is already registered. Please check your email for verification or try refreshing the status.'
          setCurrentStep('verifying')
        } else if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
          errorMessage = '⏳ Rate limited. Please wait a moment and try again.'
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = '🌐 Network error. Please check your connection and try again.'
        } else {
          errorMessage = `❌ ${error.message}`
        }
      }
      
      setError(errorMessage)
      
      // Log additional debugging information
      console.log('[Web3StorageSetup] Setup details:', {
        email: email.trim(),
        spaceName: spaceName.trim(),
        error: error
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefreshStatus = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess('🔄 Checking status...')
    
    try {
      console.log('[Web3StorageSetup] Manual status refresh requested')
      const newStatus = await checkWeb3StorageStatus()
      setStatus(newStatus)
      
      // Update step and messages based on new status
      if (newStatus.configured && newStatus.hasSpaces) {
        setCurrentStep('completed')
        setSuccess('✅ Status refreshed! Web3.Storage is fully configured.')
        setError(null)
      } else if (newStatus.configured && !newStatus.hasSpaces) {
        setCurrentStep('verified')
        setSuccess('✅ Status refreshed! Email verified - you can now create your storage space.')
        setError(null)
      } else if (newStatus.error) {
        if (newStatus.error.includes('Email verification')) {
          setCurrentStep('verifying')
          setError('⏳ Email verification still pending. Please check your email and click the verification link.')
          setSuccess(null)
        } else {
          setError(`❌ Status check: ${newStatus.error}`)
          setSuccess(null)
        }
      } else {
        setCurrentStep('initial')
        setSuccess('🔄 Status refreshed. Please complete the setup process.')
      }
      
      console.log('[Web3StorageSetup] Status refreshed:', {
        configured: newStatus.configured,
        hasSpaces: newStatus.hasSpaces,
        newStep: currentStep,
        error: newStatus.error
      })
    } catch (error) {
      console.error('[Web3StorageSetup] Failed to refresh status:', error)
      setError('❌ Failed to check status. Please try again.')
      setSuccess(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateSpace = async () => {
    if (!spaceName.trim()) {
      setError('❌ Please enter a space name')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess('🔧 Creating storage space...')
    setCurrentStep('creating-space')

    try {
      console.log('[Web3StorageSetup] Creating space:', spaceName.trim())
      await createWeb3StorageSpace(spaceName.trim())
      
      setCurrentStep('completed')
      setSuccess('🎉 Space created successfully! Web3.Storage is now fully configured and ready to use.')
      
      // Check status again after space creation - onSetupComplete will be called automatically
      setTimeout(() => {
        console.log('[Web3StorageSetup] Auto-checking status after space creation...')
        checkStatus()
      }, 1000)
    } catch (error) {
      console.error('[Web3StorageSetup] Space creation failed:', error)
      setCurrentStep('verified') // Go back to verified step
      
      let errorMessage = 'Failed to create space'
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          errorMessage = '⚠️ A space with this name already exists. Try a different name or refresh status to see existing spaces.'
        } else if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
          errorMessage = '⏳ Rate limited. Please wait a moment and try again.'
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = '🌐 Network error. Please check your connection and try again.'
        } else if (error.message.includes('unauthorized') || error.message.includes('permission')) {
          errorMessage = '🔒 Permission denied. Please refresh the status and try again.'
        } else {
          errorMessage = `❌ ${error.message}`
        }
      }
      
      setError(errorMessage)
      setSuccess(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Progress indicator component
  const ProgressIndicator = () => {
    const steps = [
      { key: 'initial', label: 'Setup', icon: '📧' },
      { key: 'email-sent', label: 'Email Sent', icon: '📤' },
      { key: 'verifying', label: 'Verifying', icon: '⏳' },
      { key: 'verified', label: 'Verified', icon: '✅' },
      { key: 'creating-space', label: 'Creating Space', icon: '🔧' },
      { key: 'completed', label: 'Complete', icon: '🎉' }
    ]

    const getCurrentStepIndex = () => {
      return steps.findIndex(step => step.key === currentStep)
    }

    const currentIndex = getCurrentStepIndex()

    return (
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isActive = index === currentIndex
            const isCompleted = index < currentIndex
            const isAccessible = index <= currentIndex
            
            return (
              <div key={step.key} className="flex items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                  ${isActive ? 'bg-blue-500 text-white' : 
                    isCompleted ? 'bg-green-500 text-white' : 
                    'bg-gray-200 text-gray-500'}
                `}>
                  {isCompleted ? '✓' : step.icon}
                </div>
                <div className="ml-2 text-xs text-gray-600">
                  {step.label}
                </div>
                {index < steps.length - 1 && (
                  <div className={`
                    w-8 h-0.5 mx-2
                    ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}
                  `} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (status?.configured && status?.hasSpaces) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <ProgressIndicator />
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">
              🎉 Web3.Storage Setup Complete!
            </h3>
            <div className="mt-2 text-sm text-green-700">
              <p><strong>✅ Status:</strong> Fully configured and ready to use</p>
              <p><strong>📦 Current space:</strong> {status.currentSpace}</p>
              <p><strong>🔒 Security:</strong> Your files will be encrypted and stored on IPFS</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show space creation step if email is verified but no spaces exist
  if (status?.configured && !status?.hasSpaces) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <ProgressIndicator />
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-blue-800">
              ✅ Email Verified! Now Create Your Storage Space
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>Great! Your email has been verified. Now you need to create a storage space for your files.</p>
            </div>
            
            <div className="mt-4">
              <div>
                <label htmlFor="spaceNameFinal" className="block text-sm font-medium text-blue-800">
                  Space Name *
                </label>
                <input
                  type="text"
                  id="spaceNameFinal"
                  value={spaceName}
                  onChange={(e) => setSpaceName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="e.g., my-secure-storage"
                  required
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && spaceName.trim() && !isLoading) {
                      handleCreateSpace()
                    }
                  }}
                />
                <p className="text-xs text-blue-600 mt-1">
                  Choose a unique name for your storage space (letters, numbers, and hyphens only)
                </p>
              </div>
              
              <div className="mt-4 flex space-x-3">
                <button
                  onClick={handleCreateSpace}
                  disabled={isLoading || !spaceName.trim()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <span className="mr-2">🔧</span>
                      <span>Create Storage Space</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleRefreshStatus}
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      <span>Checking...</span>
                    </>
                  ) : (
                    <>
                      <span className="mr-2">🔄</span>
                      <span>Refresh Status</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-4 text-sm text-red-600">
                <p>{error}</p>
              </div>
            )}

            {success && (
              <div className="mt-4 text-sm text-green-600">
                <p>{success}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <ProgressIndicator />
      <div className="flex items-start space-x-3">
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900">🚀 Set Up Web3.Storage</h3>
          <div className="text-gray-600 mb-6">
            <p className="mb-2">
              Web3.Storage provides secure, decentralized file storage for your reports using IPFS technology.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
              <p className="font-medium text-blue-800 mb-1">📋 Setup Process:</p>
              <ol className="list-decimal list-inside text-blue-700 space-y-1">
                <li>Enter your email address and choose a space name</li>
                <li>Click "Start Setup" to send verification email</li>
                <li>Check your email and click the verification link</li>
                <li>Return here and your storage space will be created automatically</li>
              </ol>
            </div>
          </div>
          
          <div className="bg-yellow-100 border border-yellow-300 rounded p-3 mt-4">
            <h4 className="font-semibold text-yellow-800 mb-2">📋 Setup Process:</h4>
            <ol className="text-sm text-yellow-700 list-decimal list-inside space-y-1">
              <li>📧 Enter your email address and choose a space name</li>
              <li>📤 Click "Send Verification Email"</li>
              <li>✅ Check your email (including spam folder) for the verification link</li>
              <li>🔗 Click the verification link in the email</li>
              <li>🔄 Return here and click "Refresh Status" to continue</li>
            </ol>
          </div>
          
          {status && (
            <div className="mt-3 text-xs text-yellow-600">
              <p>Status: {status.configured ? '✓ Account configured' : '✗ No account'}</p>
              <p>Spaces: {status.hasSpaces ? '✓ Spaces available' : '✗ No spaces'}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                📧 Email Address *
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && email.trim() && spaceName.trim() && !isLoading) {
                    handleSetup(e)
                  }
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                We'll send a verification link to this email address
              </p>
            </div>
            
            <div>
              <label htmlFor="spaceName" className="block text-sm font-medium text-gray-700 mb-1">
                📦 Storage Space Name *
              </label>
              <input
                type="text"
                id="spaceName"
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                placeholder="e.g., my-secure-reports"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && email.trim() && spaceName.trim() && !isLoading) {
                    handleSetup(e)
                  }
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Choose a unique name for your storage space (letters, numbers, and hyphens only)
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleSetup}
                disabled={isLoading || !email.trim() || !spaceName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Setting up...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Start Setup</span>
                  </>
                )}
              </button>
              
              <button
                onClick={handleRefreshStatus}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Check Status</span>
                  </>
                )}
              </button>
            </div>
            
            {currentStep === 'email-sent' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-yellow-800 text-sm">
                  📤 <strong>Verification email sent!</strong> Please check your email inbox (and spam folder) for a verification link from Web3.Storage.
                </p>
              </div>
            )}
            
            {currentStep === 'verifying' && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-blue-800 text-sm">
                  ⏳ <strong>Waiting for email verification...</strong> After clicking the verification link in your email, return here and click "Check Status" to continue.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
      
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

    </div>
  )
}

export default Web3StorageSetup