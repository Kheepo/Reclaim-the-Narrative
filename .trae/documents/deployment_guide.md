# Decentralized Anonymous Reporting Platform - Deployment Guide

## 1. Prerequisites

### 1.1 Development Environment
- Node.js 18+ and npm/yarn
- Git for version control
- MetaMask browser extension
- Polygon Mumbai testnet MATIC tokens (from faucet)
- web3.storage API key

### 1.2 Required Accounts
- web3.storage account for IPFS storage
- Polygon wallet with MATIC for gas fees
- Vercel account for frontend deployment
- Alchemy/Infura account for RPC endpoints

## 2. Project Setup

### 2.1 Initialize Project
```bash
# Create new Next.js project
npx create-next-app@latest gbv-reporting-platform --typescript --tailwind --eslint
cd gbv-reporting-platform

# Install blockchain dependencies
npm install ethers@6 @web3-storage/w3up-client
npm install @walletconnect/web3-provider @walletconnect/modal

# Install development dependencies
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install --save-dev @types/node typescript

# Install additional dependencies
npm install jspdf html2canvas crypto-js
npm install @headlessui/react @heroicons/react
```

### 2.2 Environment Configuration
```bash
# Create .env.local file
NEXT_PUBLIC_POLYGON_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_API_KEY
NEXT_PUBLIC_POLYGON_MAINNET_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY
NEXT_PUBLIC_CONTRACT_ADDRESS_MUMBAI=0x...
NEXT_PUBLIC_CONTRACT_ADDRESS_POLYGON=0x...
NEXT_PUBLIC_WEB3_STORAGE_TOKEN=your_web3_storage_token
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_ENVIRONMENT=development
```

## 3. Smart Contract Deployment

### 3.1 Hardhat Setup
```typescript
// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    polygonMumbai: {
      url: process.env.POLYGON_MUMBAI_RPC_URL,
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 80001,
      gasPrice: 20000000000
    },
    polygon: {
      url: process.env.POLYGON_MAINNET_RPC_URL,
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 137,
      gasPrice: 30000000000
    }
  },
  etherscan: {
    apiKey: {
      polygonMumbai: process.env.POLYGONSCAN_API_KEY!,
      polygon: process.env.POLYGONSCAN_API_KEY!
    }
  }
};

export default config;
```

### 3.2 Deploy Script
```typescript
// scripts/deploy.ts
import { ethers } from "hardhat";

async function main() {
  console.log("Deploying GBVReportRegistry contract...");
  
  const GBVReportRegistry = await ethers.getContractFactory("GBVReportRegistry");
  const contract = await GBVReportRegistry.deploy();
  
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  
  console.log(`GBVReportRegistry deployed to: ${contractAddress}`);
  
  // Verify contract on Polygonscan
  if (process.env.POLYGONSCAN_API_KEY) {
    console.log("Waiting for block confirmations...");
    await contract.deploymentTransaction()?.wait(6);
    
    console.log("Verifying contract...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: []
      });
    } catch (error) {
      console.log("Verification failed:", error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### 3.3 Deployment Commands
```bash
# Deploy to Mumbai testnet
npx hardhat run scripts/deploy.ts --network polygonMumbai

# Deploy to Polygon mainnet
npx hardhat run scripts/deploy.ts --network polygon

# Verify contract
npx hardhat verify --network polygonMumbai CONTRACT_ADDRESS
```

## 4. Frontend Development

### 4.1 Core Modules Structure
```
src/
├── components/
│   ├── WalletConnect.tsx
│   ├── ReportForm.tsx
│   ├── FileUpload.tsx
│   ├── VerificationForm.tsx
│   └── CertificateGenerator.tsx
├── lib/
│   ├── encryption.ts
│   ├── ipfs.ts
│   ├── blockchain.ts
│   ├── certificate.ts
│   └── storage.ts
├── pages/
│   ├── index.tsx
│   ├── submit.tsx
│   ├── verify.tsx
│   └── certificate/[txHash].tsx
└── types/
    ├── report.ts
    ├── blockchain.ts
    └── certificate.ts
```

### 4.2 Key Implementation Files

**Encryption Module (lib/encryption.ts)**
```typescript
export class EncryptionService {
  static async generateKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }
  
  static async encryptData(data: ArrayBuffer, key: CryptoKey): Promise<{
    encryptedData: ArrayBuffer;
    iv: Uint8Array;
  }> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    return { encryptedData, iv };
  }
  
  static async hashData(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
```

**IPFS Module (lib/ipfs.ts)**
```typescript
import { create } from '@web3-storage/w3up-client';

export class IPFSService {
  private client: any;
  
  async initialize() {
    this.client = await create();
    await this.client.login(process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN);
  }
  
  async uploadFile(file: File): Promise<string> {
    const cid = await this.client.uploadFile(file);
    return cid.toString();
  }
  
  async uploadMultipleFiles(files: File[]): Promise<string[]> {
    const uploads = await Promise.all(
      files.map(file => this.uploadFile(file))
    );
    return uploads;
  }
}
```

## 5. Security Considerations

### 5.1 Client-side Security
- All encryption happens in browser using Web Crypto API
- Private keys never leave the user's device
- No sensitive data stored on servers
- HTTPS enforced for all communications
- Content Security Policy headers implemented

### 5.2 Smart Contract Security
- Input validation for all parameters
- Reentrancy protection
- Gas optimization to prevent DoS attacks
- Event emission for transparency
- No storage of sensitive content

### 5.3 Privacy Protection
- Pseudonymous identity via wallet addresses
- No collection of personally identifiable information
- Encrypted file storage on IPFS
- Optional Shamir's Secret Sharing for key recovery

## 6. Deployment to Production

### 6.1 Vercel Deployment
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Set environment variables
vercel env add NEXT_PUBLIC_POLYGON_RPC_URL
vercel env add NEXT_PUBLIC_CONTRACT_ADDRESS_POLYGON
vercel env add NEXT_PUBLIC_WEB3_STORAGE_TOKEN
```

### 6.2 Domain Configuration
```bash
# Add custom domain
vercel domains add your-domain.com

# Configure DNS
# Add CNAME record: your-domain.com -> cname.vercel-dns.com
```

### 6.3 Performance Optimization
- Enable Vercel Edge Functions for global distribution
- Implement service worker for offline functionality
- Optimize images and assets
- Enable compression and caching headers

## 7. Monitoring and Maintenance

### 7.1 Analytics Setup
```typescript
// lib/analytics.ts
export const trackReportSubmission = (txHash: string) => {
  // Privacy-preserving analytics
  if (typeof window !== 'undefined') {
    // Track without PII
    console.log('Report submitted:', txHash.substring(0, 10) + '...');
  }
};
```

### 7.2 Error Monitoring
- Implement client-side error tracking
- Monitor blockchain transaction failures
- Track IPFS upload success rates
- Set up alerts for critical failures

### 7.3 Updates and Upgrades
- Smart contract is immutable once deployed
- Frontend can be updated via Vercel deployments
- Maintain backward compatibility
- Document all changes for transparency

## 8. Testing Strategy

### 8.1 Unit Testing
```bash
# Install testing dependencies
npm install --save-dev jest @testing-library/react @testing-library/jest-dom

# Run tests
npm test
```

### 8.2 Integration Testing
- Test wallet connection flows
- Verify encryption/decryption cycles
- Test IPFS upload/retrieval
- Validate smart contract interactions

### 8.3 Security Testing
- Penetration testing for client-side vulnerabilities
- Smart contract audit before mainnet deployment
- IPFS content verification
- Privacy leak assessment

## 9. Legal and Compliance

### 9.1 Disclaimer Requirements
- Clear statement that platform is not emergency service
- Privacy policy explaining data handling
- Terms of service for platform usage
- Jurisdiction and legal framework disclosure

### 9.2 Data Protection
- GDPR compliance for EU users
- Right to be forgotten implementation
- Data minimization principles
- Consent management for analytics

This deployment guide ensures a secure, scalable, and legally compliant implementation of the decentralized reporting platform while maintaining the highest standards of privacy and security for survivors.

