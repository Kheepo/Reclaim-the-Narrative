# Decentralized Anonymous Reporting Platform - User Documentation

## Table of Contents
1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Navigation Guide](#navigation-guide)
4. [Technical Requirements](#technical-requirements)
5. [How to Use the Platform](#how-to-use-the-platform)
6. [Frequently Asked Questions](#frequently-asked-questions)
7. [Support & Contact Information](#support--contact-information)

---

## Overview

### Purpose
The Decentralized Anonymous Reporting Platform is a secure, blockchain-based system designed to enable anonymous reporting of gender-based violence (GBV) and other sensitive incidents. The platform prioritizes user safety, data integrity, and complete anonymity while providing verifiable proof of report submissions.

### Main Objectives
- **Anonymous Reporting**: Enable users to submit reports without revealing their identity
- **Data Security**: Protect sensitive information through advanced encryption
- **Immutable Records**: Use blockchain technology to create tamper-proof evidence
- **Decentralized Storage**: Store encrypted data on IPFS for enhanced security
- **Legal Verification**: Provide verifiable certificates for legal proceedings

### Target Audience
- **Primary Users**: Individuals who need to report sensitive incidents anonymously
- **Secondary Users**: Legal professionals, advocacy organizations, and support services
- **Technical Users**: Developers and administrators managing the platform

---

## Key Features

### 🔒 Anonymous Report Submission
- Submit detailed incident reports without revealing personal identity
- Upload supporting files (documents, images, audio recordings)
- Automatic encryption of all submitted data
- Generate unique transaction hash for future reference

### 🛡️ Advanced Security
- **AES-256 Encryption**: Military-grade encryption for all sensitive data
- **Blockchain Integration**: Immutable record storage on Ethereum network
- **IPFS Storage**: Decentralized file storage for enhanced privacy
- **No Personal Data Storage**: Platform never stores identifying information

### ✅ Report Verification
- Verify report authenticity using transaction hash
- Decrypt and view reports with proper authorization
- Generate legal certificates for court proceedings
- Blockchain-based proof of submission timestamp

### 📱 User-Friendly Interface
- Intuitive design suitable for users under stress
- Mobile-responsive for access on any device
- Clear safety warnings and privacy information
- Offline draft saving for incomplete reports

### 🔗 Wallet Integration
- MetaMask wallet support for blockchain interactions
- WalletConnect for mobile wallet compatibility
- Automatic network detection and switching
- Gas fee estimation for transactions

---

## Navigation Guide

### Main Navigation Menu
The platform consists of four main sections accessible from the top navigation:

#### 🏠 Home Page (`/`)
- **Purpose**: Platform introduction and safety information
- **Key Elements**:
  - Safety disclaimer and privacy notice
  - Quick access to submit and verify functions
  - Platform overview and security features
  - Emergency contact information

#### 📝 Submit Report (`/submit`)
- **Purpose**: Create and submit new incident reports
- **Key Elements**:
  - Comprehensive report form
  - File upload functionality
  - Encryption password setup
  - Draft saving capabilities
  - Submission confirmation

#### 🔍 Verify Report (`/verify`)
- **Purpose**: Verify existing reports using transaction hash
- **Key Elements**:
  - Transaction hash input field
  - Blockchain verification results
  - Report decryption interface
  - Certificate generation options

#### 📄 Generate Certificate (`/certificate`)
- **Purpose**: Create legal certificates for verified reports
- **Key Elements**:
  - Certificate customization options
  - PDF generation and download
  - Legal formatting compliance
  - Blockchain verification details

### Wallet Connection
- **Location**: Top-right corner of all pages
- **Function**: Connect/disconnect cryptocurrency wallet
- **Supported Wallets**: MetaMask, WalletConnect-compatible wallets

---

## Technical Requirements

### Browser Requirements
- **Recommended Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **JavaScript**: Must be enabled
- **Local Storage**: Required for draft saving and settings
- **WebCrypto API**: Required for encryption (available in modern browsers)

### Wallet Requirements
- **MetaMask Extension**: Version 10.0+ recommended
- **Mobile Wallets**: Any WalletConnect v2 compatible wallet
- **Network**: Ethereum Mainnet or supported testnets
- **ETH Balance**: Small amount required for transaction fees (typically $1-5 USD)

### System Requirements
- **Internet Connection**: Required for blockchain interactions and IPFS uploads
- **Device Storage**: Minimum 100MB free space for temporary files
- **RAM**: 4GB+ recommended for optimal performance

### Network Configuration
- **Ethereum Network**: Mainnet (Chain ID: 1) or Sepolia Testnet (Chain ID: 11155111)
- **RPC Endpoints**: Automatic configuration through wallet
- **Gas Fees**: Variable based on network congestion

---

## How to Use the Platform

### Step 1: Initial Setup
1. **Install Wallet**: Download and install MetaMask or compatible wallet
2. **Fund Wallet**: Add small amount of ETH for transaction fees
3. **Visit Platform**: Navigate to the platform URL
4. **Read Safety Notice**: Review important privacy and safety information

### Step 2: Submitting a Report
1. **Connect Wallet**: Click "Connect Wallet" button in top-right corner
2. **Navigate to Submit**: Click "Submit Report" in main navigation
3. **Fill Report Form**:
   - Enter incident title and description
   - Select appropriate category
   - Provide location and date/time information
   - Add any additional relevant details
4. **Upload Files** (Optional):
   - Click "Upload Files" button
   - Select supporting documents, images, or audio files
   - Files are automatically encrypted before upload
5. **Set Encryption Password**:
   - Create a strong, memorable password
   - This password is required to decrypt the report later
   - **Important**: Store this password securely - it cannot be recovered
6. **Review and Submit**:
   - Review all information for accuracy
   - Click "Submit Report" button
   - Confirm blockchain transaction in wallet
   - Save the transaction hash provided after submission

### Step 3: Verifying a Report
1. **Navigate to Verify**: Click "Verify Report" in main navigation
2. **Enter Transaction Hash**: Input the hash from report submission
3. **View Verification Results**:
   - Blockchain confirmation details
   - Submission timestamp
   - IPFS storage confirmation
4. **Decrypt Report** (if authorized):
   - Enter the encryption password
   - View decrypted report content
   - Access uploaded files

### Step 4: Generating Certificates
1. **Verify Report First**: Complete report verification process
2. **Navigate to Certificate**: Click "Generate Certificate" in main navigation
3. **Enter Report Details**: Provide transaction hash and verification info
4. **Customize Certificate**: Add any required legal information
5. **Generate PDF**: Click "Generate Certificate" to create legal document
6. **Download**: Save the certificate for legal proceedings

---

## Frequently Asked Questions

### General Questions

**Q: Is my identity completely anonymous?**
A: Yes, the platform never collects or stores any personally identifying information. Your wallet address is used only for blockchain transactions and cannot be linked to your real identity without additional information.

**Q: Can my report be deleted or modified after submission?**
A: No, once submitted to the blockchain, reports become immutable and cannot be changed or deleted. This ensures the integrity of evidence for legal proceedings.

**Q: What happens if I lose my encryption password?**
A: Unfortunately, lost encryption passwords cannot be recovered. The report will remain on the blockchain as proof of submission, but the content cannot be decrypted without the password.

**Q: How much does it cost to submit a report?**
A: The only cost is the Ethereum network transaction fee (gas fee), typically ranging from $1-10 USD depending on network congestion. The platform itself is free to use.

### Technical Questions

**Q: Which wallets are supported?**
A: The platform supports MetaMask (browser extension and mobile app) and any wallet compatible with WalletConnect v2, including Trust Wallet, Rainbow, and Coinbase Wallet.

**Q: What file types can I upload?**
A: The platform supports common file types including:
- Documents: PDF, DOC, DOCX, TXT
- Images: JPG, PNG, GIF, WEBP
- Audio: MP3, WAV, M4A
- Video: MP4, MOV, AVI (size limits apply)

**Q: Is there a file size limit?**
A: Yes, individual files are limited to 10MB, with a total upload limit of 50MB per report to ensure reasonable IPFS storage costs.

**Q: Can I use the platform on mobile devices?**
A: Yes, the platform is fully responsive and works on mobile devices. You can use mobile wallets through WalletConnect for blockchain interactions.

### Security Questions

**Q: How secure is the encryption?**
A: The platform uses AES-256 encryption, the same standard used by governments and military organizations. Your encryption password is never transmitted or stored anywhere.

**Q: Can law enforcement access my reports?**
A: Law enforcement cannot access report content without the encryption password. However, they can verify that a report was submitted at a specific time using the blockchain transaction hash.

**Q: What if the platform website goes down?**
A: Your reports are stored on the decentralized IPFS network and Ethereum blockchain, not on our servers. Even if the website is unavailable, your data remains accessible through the blockchain and IPFS.

### Legal Questions

**Q: Are the certificates legally valid?**
A: The certificates provide cryptographic proof of report submission and timestamp. Legal validity depends on your jurisdiction's acceptance of blockchain evidence. Consult with legal professionals in your area.

**Q: Can I use this for court proceedings?**
A: The platform provides verifiable evidence of report submission, but admissibility in court varies by jurisdiction. The blockchain timestamp and cryptographic verification can support legal cases.

**Q: Is this platform compliant with data protection laws?**
A: The platform is designed with privacy-by-design principles. Since no personal data is collected or stored, it aligns with GDPR and similar privacy regulations.

---

## Support & Contact Information

### Emergency Resources
**If you are in immediate danger, contact local emergency services immediately.**

### Platform Support

#### Technical Support
- **Email**: support@gbv-reporting-platform.org
- **Response Time**: 24-48 hours
- **Available**: Monday-Friday, 9 AM - 5 PM UTC

#### Documentation & Guides
- **User Guide**: Available at `/docs/user-guide`
- **Technical Documentation**: Available at `/docs/technical`
- **Video Tutorials**: Available at `/docs/tutorials`

### Crisis Support Resources

#### International
- **UN Women Helpline**: Available in multiple languages
- **International Domestic Violence Hotlines**: [hotline.org](https://hotline.org)

#### United States
- **National Domestic Violence Hotline**: 1-800-799-7233
- **RAINN National Sexual Assault Hotline**: 1-800-656-4673

#### United Kingdom
- **National Domestic Abuse Helpline**: 0808 2000 247
- **Rape Crisis National Helpline**: 0808 802 9999

#### Canada
- **Assaulted Women's Helpline**: 1-866-863-0511
- **Kids Help Phone**: 1-800-668-6868

### Community & Advocacy

#### Partner Organizations
- **Local Women's Shelters**: Contact information varies by location
- **Legal Aid Organizations**: Free legal assistance for survivors
- **Counseling Services**: Professional trauma support

#### Online Communities
- **Support Forums**: Moderated peer support groups
- **Resource Libraries**: Educational materials and guides
- **Safety Planning Tools**: Interactive safety planning resources

### Platform Development

#### Open Source
- **GitHub Repository**: [github.com/gbv-reporting-platform](https://github.com/gbv-reporting-platform)
- **Issue Tracking**: Report bugs and request features
- **Contribution Guidelines**: How to contribute to development

#### Security
- **Security Audits**: Regular third-party security assessments
- **Bug Bounty Program**: Responsible disclosure rewards
- **Security Contact**: security@gbv-reporting-platform.org

---

## Important Disclaimers

### Privacy Notice
This platform is designed to protect your privacy and anonymity. However, please be aware that:
- Your internet service provider may see that you visited this website
- Consider using a VPN or Tor browser for additional privacy
- Clear your browser history after use if using a shared computer

### Legal Disclaimer
This platform provides tools for anonymous reporting and evidence preservation. It does not:
- Provide legal advice or representation
- Guarantee legal admissibility of reports
- Replace professional counseling or support services
- Ensure immediate intervention in crisis situations

### Technical Disclaimer
While we implement industry-standard security measures:
- No system is 100% secure
- Users are responsible for protecting their encryption passwords
- Blockchain transactions are irreversible
- Network fees are subject to change

---

*Last Updated: January 2024*
*Version: 1.0*

**Remember: Your safety is the top priority. If you are in immediate danger, contact local emergency services.**