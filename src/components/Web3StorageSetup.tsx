import React, { useState, useEffect } from 'react'
import { setupWeb3Storage, createWeb3StorageSpace, checkWeb3StorageStatus } from '../lib/ipfs'

interface Web3StorageSetupProps {
  onSetupComplete?: () => void
}

export const Web3StorageSetup: React.FC<Web3StorageSetupProps> = ({ onSetupComplete }) => {
  const [email, setEmail] = useState('')
  const [spaceName, setSpaceName] = useState('GBV-Reporting-Platform')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{
    configured: boolean
    hasSpaces: boolean
    currentSpace?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    try {
      const statusResult = await checkWeb3StorageStatus()
      setStatus(statusResult)
    } catch (error) {
      console.error('Failed to check status:', error)
    }
  }

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim()) {
      setError('Please enter a valid email address')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await setupWeb3Storage(email.trim(), spaceName.trim())
      setSuccess(
        'Setup initiated! Please check your email and click the verification link. ' +
        'After verification, refresh this page to continue.'
      )
      
      // Check status again after a delay
      setTimeout(() => {
        checkStatus()
      }, 2000)
      
      if (onSetupComplete) {
        onSetupComplete()
      }
    } catch (error) {
      console.error('Setup failed:', error)
      setError(
        error instanceof Error 
          ? error.message 
          : 'Setup failed. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefreshStatus = async () => {
    setIsLoading(true)
    await checkStatus()
    setIsLoading(false)
  }

  const handleCreateSpace = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await createWeb3StorageSpace(spaceName.trim())
      setSuccess('Space created successfully! You can now upload files to IPFS.')
      
      // Check status again after space creation
      setTimeout(() => {
        checkStatus()
      }, 1000)
      
      if (onSetupComplete) {
        onSetupComplete()
      }
    } catch (error) {
      console.error('Space creation failed:', error)
      setError(
        error instanceof Error 
          ? error.message 
          : 'Failed to create space. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (status?.configured && status?.hasSpaces) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">
              Web3.Storage is properly configured!
            </h3>
            <div className="mt-2 text-sm text-green-700">
              <p>Current space: {status.currentSpace}</p>
              <p>You can now upload files to IPFS.</p>
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
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-blue-800">
              Email Verified! Now Create Your Storage Space
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>Great! Your email has been verified. Now you need to create a storage space for your files.</p>
            </div>
            
            <div className="mt-4">
              <div>
                <label htmlFor="spaceNameFinal" className="block text-sm font-medium text-blue-800">
                  Space Name
                </label>
                <input
                  type="text"
                  id="spaceNameFinal"
                  value={spaceName}
                  onChange={(e) => setSpaceName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="GBV-Reporting-Platform"
                  required
                />
              </div>
              
              <div className="mt-4 flex space-x-3">
                <button
                  onClick={handleCreateSpace}
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isLoading ? 'Creating Space...' : 'Create Storage Space'}
                </button>
                
                <button
                  onClick={handleRefreshStatus}
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  Refresh Status
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
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Web3.Storage Setup Required
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>To upload files to IPFS, you need to configure web3.storage first.</p>
          </div>
          
          {status && (
            <div className="mt-3 text-xs text-yellow-600">
              <p>Status: {status.configured ? '✓ Account configured' : '✗ No account'}</p>
              <p>Spaces: {status.hasSpaces ? '✓ Spaces available' : '✗ No spaces'}</p>
            </div>
          )}

          <form onSubmit={handleSetup} className="mt-4 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-yellow-800">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-yellow-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
                placeholder="your@email.com"
                required
              />
            </div>
            
            <div>
              <label htmlFor="spaceName" className="block text-sm font-medium text-yellow-800">
                Space Name
              </label>
              <input
                type="text"
                id="spaceName"
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-yellow-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
                placeholder="GBV-Reporting-Platform"
                required
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
              >
                {isLoading ? 'Setting up...' : 'Setup Web3.Storage'}
              </button>
              
              <button
                type="button"
                onClick={handleRefreshStatus}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-yellow-300 text-sm font-medium rounded-md text-yellow-700 bg-white hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
              >
                Refresh Status
              </button>
            </div>
          </form>

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

          <div className="mt-4 text-xs text-yellow-600">
            <p><strong>Instructions:</strong></p>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Enter your email address and click "Setup Web3.Storage"</li>
              <li>Check your email for a verification link from web3.storage</li>
              <li>Click the verification link to confirm your account</li>
              <li>Return here and click "Refresh Status" - you'll then be able to create your storage space</li>
              <li>Create your storage space to complete the setup</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Web3StorageSetup