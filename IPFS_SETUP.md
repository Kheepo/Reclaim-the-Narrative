# IPFS Configuration Guide

This guide will help you configure IPFS upload services for the GBV Reporting Platform. The platform supports two IPFS providers: **Storacha Network** (formerly Web3.Storage, recommended) and **Pinata** (fallback).

## Quick Setup

### Option 1: Storacha Network (Recommended)

**Storacha Network** is the evolution of Web3.Storage, offering modern email-based authentication without API tokens.

1. **No pre-configuration needed**
   - Storacha uses email-based authentication
   - No API keys or tokens required in environment variables
   - Authentication happens directly in the application

2. **First-time setup in the application**
   - When you first try to upload a file, the app will prompt for email authentication
   - Enter your email address when prompted
   - Check your email for a verification link
   - Click the verification link to complete authentication
   - The app will automatically create and configure your storage space

3. **Account creation (if needed)**
   - Visit [console.storacha.network](https://console.storacha.network) to create an account
   - Or let the application create one for you during first upload

### Option 2: Pinata (Alternative)

1. **Sign up for Pinata**
   - Visit [pinata.cloud](https://pinata.cloud)
   - Create a free account

2. **Get your API keys**
   - Go to [API Keys](https://app.pinata.cloud/keys)
   - Click "New Key"
   - Enable "pinFileToIPFS" permission
   - Copy both the API Key and Secret Key

3. **Configure environment variables**
   - Open the `.env` file in your project root
   - Replace the placeholder values:
   ```
   REACT_APP_PINATA_API_KEY=your_actual_pinata_api_key
   REACT_APP_PINATA_SECRET_KEY=your_actual_pinata_secret_key
   ```

## Environment Variables Reference

### Storacha Network
```
# No environment variables needed!
# Storacha uses email-based authentication
```

### Required for Pinata (if using as fallback)
```
REACT_APP_PINATA_API_KEY=your_pinata_api_key_here
REACT_APP_PINATA_SECRET_KEY=your_pinata_secret_key_here
```

## Troubleshooting

### "No IPFS upload service available" Error

This error occurs when neither Storacha Network nor Pinata is properly configured. To fix:

1. **For Storacha Network**
   - No environment variables needed - authentication is email-based
   - Try uploading a file and follow the email authentication prompts
   - Check your email for verification links
   - Ensure you have a stable internet connection

2. **For Pinata (if using as fallback)**
   - Check your environment variables in the `.env` file
   - Ensure you've replaced placeholder values with actual API keys
   - Verify there are no extra spaces or quotes around the values

3. **Restart the development server**
   ```bash
   npm run dev
   ```
   Environment variables are loaded when the server starts.

4. **Verify service availability**
   - **Storacha Network**: Visit [console.storacha.network](https://console.storacha.network)
   - **Pinata**: Test your keys in the [Pinata dashboard](https://app.pinata.cloud)

### Network Issues

If uploads fail due to network issues:

1. **Check your internet connection**
2. **Try uploading smaller files first**
3. **Check if your firewall/antivirus is blocking the requests**
4. **Try using a different network (mobile hotspot)**

### Rate Limiting

Both services have rate limits:

- **Storacha Network**: Generous limits for individual users (varies by plan)
- **Pinata**: 180 requests per minute (free tier)

If you hit rate limits, wait a few minutes before trying again.

## Security Notes

- **Storacha Network**: Uses secure email-based authentication - no API keys to manage
- **Pinata**: Never commit your actual API keys to version control
- **Use environment variables for all sensitive configuration**
- **Regularly rotate your API keys (Pinata only)**
- **Monitor your usage in the provider dashboards**

## Support

If you continue to experience issues:

1. Check the browser console for detailed error messages
2. For Storacha: Ensure you've completed email verification
3. For Pinata: Verify your API keys are correctly formatted
4. Ensure your account has sufficient quota/credits
5. Contact the respective service support:
   - [Storacha Network Documentation](https://docs.storacha.network/)
   - [Pinata Support](https://docs.pinata.cloud/)