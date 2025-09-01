# IPFS Configuration Setup Guide

## Overview

This guide will help you configure IPFS upload services for the GBV Reporting Platform. The platform supports two IPFS providers:

1. **Web3.Storage (Storacha Network)** - Primary service (email-based authentication)
2. **Pinata** - Fallback service (API key-based authentication)

## Quick Setup

### Step 1: Configure Pinata (Recommended)

1. **Create Pinata Account**
   - Visit: https://app.pinata.cloud/
   - Sign up for a free account
   - Verify your email address

2. **Generate API Keys**
   - Go to: https://app.pinata.cloud/keys
   - Click "New Key"
   - Select permissions: `pinFileToIPFS`, `pinJSONToIPFS`
   - Name your key (e.g., "GBV Platform")
   - Copy the API Key and Secret Key

3. **Update Environment Variables**
   
   Open your `.env` file and replace the placeholder values:
   
   ```env
   # Replace these placeholder values with your actual Pinata credentials
   REACT_APP_PINATA_API_KEY=your_actual_pinata_api_key_here
   REACT_APP_PINATA_SECRET_KEY=your_actual_pinata_secret_key_here
   
   # Optional: For public access (if needed)
   NEXT_PUBLIC_PINATA_API_KEY=your_actual_pinata_api_key_here
   NEXT_PUBLIC_PINATA_SECRET_KEY=your_actual_pinata_secret_key_here
   ```

### Step 2: Configure Web3.Storage (Optional)

1. **Email Authentication**
   - Web3.Storage uses email-based authentication
   - No API keys required in environment variables
   - Authentication happens in the browser during first upload

2. **Setup Process**
   - Visit: https://console.web3.storage/
   - Sign up with your email
   - Verify your email address
   - The platform will automatically handle authentication

## Testing Your Configuration

### Method 1: Use the Diagnostic Tool

```bash
node test-ipfs-simple.js
```

This will check your environment variables and API connectivity.

### Method 2: Test Upload in Application

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to the report submission page
3. Try uploading a small file
4. Check the browser console for any errors

## Troubleshooting

### Common Issues

#### 1. "IPFS upload service unavailable"

**Cause**: API keys not configured or invalid

**Solution**:
- Verify your Pinata API keys are correct
- Check that you've saved the `.env` file
- Restart your development server after updating `.env`

#### 2. "Pinata API authentication failed"

**Cause**: Invalid or expired API keys

**Solution**:
- Generate new API keys from Pinata dashboard
- Ensure the keys have the correct permissions
- Check for any extra spaces or characters in the `.env` file

#### 3. "Web3.Storage authentication required"

**Cause**: Email not verified or authentication expired

**Solution**:
- Check your email for verification link
- Try logging out and back into Web3.Storage console
- Clear browser cache and cookies for web3.storage domain

### Validation Checklist

- [ ] Pinata account created and email verified
- [ ] API keys generated with correct permissions
- [ ] `.env` file updated with actual values (not placeholders)
- [ ] Development server restarted after configuration
- [ ] Test upload completed successfully

### Environment Variable Format

Your `.env` file should look like this (with actual values):

```env
# Pinata Configuration - REQUIRED
REACT_APP_PINATA_API_KEY=pk_1234567890abcdef1234567890abcdef
REACT_APP_PINATA_SECRET_KEY=sk_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890

# Public Pinata Configuration - OPTIONAL
NEXT_PUBLIC_PINATA_API_KEY=pk_1234567890abcdef1234567890abcdef
NEXT_PUBLIC_PINATA_SECRET_KEY=sk_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
```

## Security Notes

1. **Never commit API keys to version control**
   - The `.env` file should be in your `.gitignore`
   - Use environment variables in production

2. **API Key Permissions**
   - Only grant necessary permissions to Pinata keys
   - Regularly rotate your API keys

3. **Rate Limits**
   - Pinata free tier has upload limits
   - Monitor your usage in the Pinata dashboard

## Production Deployment

For production deployment, set environment variables through your hosting platform:

### Vercel
```bash
vercel env add REACT_APP_PINATA_API_KEY
vercel env add REACT_APP_PINATA_SECRET_KEY
```

### Netlify
Add variables in Site Settings > Environment Variables

### Other Platforms
Consult your hosting provider's documentation for environment variable configuration.

## Support

If you continue to experience issues:

1. Check the browser console for detailed error messages
2. Review the `IPFS_FAILURE_ANALYSIS.md` report
3. Run the diagnostic tool: `node test-ipfs-simple.js`
4. Verify your API keys in the Pinata dashboard

## Next Steps

After successful configuration:

1. Test file uploads with various file sizes
2. Monitor upload success rates
3. Set up monitoring and alerting for production
4. Consider implementing upload progress indicators

---

**Last Updated**: $(date)
**Version**: 1.0
**Status**: Ready for Implementation