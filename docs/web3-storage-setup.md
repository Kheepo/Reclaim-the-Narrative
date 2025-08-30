# Web3.Storage Setup Guide

This guide explains how to set up web3.storage for IPFS uploads in the GBV Reporting Platform.

## Overview

The platform uses `@storacha/client` version 17.3.0, which implements UCAN (User Controlled Authorization Networks) for authentication. This requires proper setup of Agents and Spaces for blob upload permissions.

## Setup Process

### 1. Initial Configuration

When you first access the report submission page, you'll see a "Web3.Storage Configuration" section if the service isn't configured yet.

### 2. Email Authentication

1. Enter your email address in the setup form
2. Click "Login with Email"
3. Check your email for a verification link
4. Click the verification link to complete authentication

### 3. Space Creation

After email verification:
1. Click "Create Space" to create a new IPFS storage space
2. The space will be automatically provisioned with the necessary permissions
3. Wait for the "Space created and provisioned successfully" message

### 4. Verification

Once setup is complete:
- The status should show "✅ Configured" and "✅ Has Spaces"
- You can now proceed with report submission and file uploads

## Technical Details

### Authentication Flow

The platform uses UCAN-based authentication with:
- **Agents**: Local keypairs for invoking capabilities
- **Spaces**: Namespaces for uploads identified by DIDs
- **Delegation**: Mechanism for granting blob/add permissions

### Error Handling

The system includes robust error handling with:
- Automatic retry mechanisms (up to 3 attempts)
- Exponential backoff for failed uploads
- Specific error messages for common issues:
  - Missing blob/add permissions
  - Unconfigured accounts
  - Network connectivity issues

### Storage Persistence

Configuration data is stored in the browser's localStorage:
- Agent keypairs
- Space delegations
- Authentication tokens

## Troubleshooting

### Common Issues

1. **"Missing blob/add permission" error**
   - Ensure you've completed the space creation process
   - Try refreshing the page and checking the configuration status

2. **"Account not configured" error**
   - Complete the email authentication process
   - Ensure you've clicked the verification link in your email

3. **Upload failures**
   - Check your internet connection
   - The system will automatically retry failed uploads
   - If issues persist, try reconfiguring web3.storage

### Reconfiguration

If you need to reconfigure web3.storage:
1. Clear your browser's localStorage for this domain
2. Refresh the page
3. Complete the setup process again

## Security Considerations

- All authentication data is stored locally in your browser
- No sensitive credentials are transmitted to our servers
- IPFS uploads are public by default - ensure sensitive data is properly encrypted
- The platform automatically encrypts report data before IPFS upload

## Support

If you encounter issues not covered in this guide:
1. Check the browser console for detailed error messages
2. Ensure you're using a supported browser (Chrome, Firefox, Safari, Edge)
3. Contact the development team with specific error messages