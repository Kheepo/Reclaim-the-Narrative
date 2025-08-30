# GBV Reporting Platform

A decentralized platform for reporting and tracking Gender-Based Violence (GBV) incidents using blockchain technology to ensure data integrity, transparency, and security.

## 🌟 Features

- **Secure Reporting**: Anonymous and secure incident reporting with blockchain verification
- **Data Integrity**: Immutable records stored on blockchain ensuring data cannot be tampered with
- **Privacy Protection**: Advanced encryption and privacy measures to protect reporter identity
- **Real-time Analytics**: Dashboard for tracking and analyzing GBV incidents
- **Multi-network Support**: Compatible with multiple blockchain networks
- **Responsive Design**: Mobile-friendly interface for accessibility

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Blockchain**: Hardhat, Ethers.js, Solidity
- **Testing**: Jest, Hardhat Testing Framework
- **Development**: ESLint, TypeScript

## 📋 Prerequisites

Before running this project, make sure you have:

- Node.js (v18 or higher)
- npm or yarn package manager
- MetaMask or compatible Web3 wallet
- Git

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd gbv-reporting-platform
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Environment Setup

Create a `.env.local` file in the root directory:

```env
# Add your environment variables here
NEXT_PUBLIC_NETWORK_NAME=localhost
NEXT_PUBLIC_CHAIN_ID=31337
```

### 4. Start Local Blockchain (Development)

```bash
npx hardhat node
```

### 5. Deploy Smart Contracts

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

### 6. Run the Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run Smart Contract Tests

```bash
npx hardhat test
```

### Run Frontend Tests

```bash
npm run test:frontend
```

## 📁 Project Structure

```
gbv-reporting-platform/
├── contracts/              # Smart contracts
├── scripts/                # Deployment scripts
├── test/                   # Smart contract tests
├── src/
│   ├── components/         # React components
│   ├── pages/             # Next.js pages
│   ├── hooks/             # Custom React hooks
│   ├── contexts/          # React contexts
│   ├── lib/               # Utility libraries
│   ├── styles/            # CSS styles
│   └── types/             # TypeScript type definitions
├── public/                # Static assets
└── typechain-types/       # Generated TypeScript types
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run all tests
- `npx hardhat compile` - Compile smart contracts
- `npx hardhat test` - Run smart contract tests

## 🌐 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Configure environment variables
4. Deploy

### Deploy Smart Contracts

```bash
# Deploy to testnet
npx hardhat run scripts/deploy.ts --network sepolia

# Deploy to mainnet
npx hardhat run scripts/deploy.ts --network mainnet
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](../../issues) page
2. Create a new issue if your problem isn't already reported
3. Provide detailed information about your environment and the issue

## 🔒 Security

This platform handles sensitive data. Please:

- Never commit private keys or sensitive information
- Use environment variables for configuration
- Report security vulnerabilities responsibly
- Keep dependencies updated

## 📊 Testing Report

For detailed testing information, see [TESTING_REPORT.md](TESTING_REPORT.md).

---

**Note**: This platform is designed to support GBV reporting and should be used responsibly with proper legal and ethical considerations.
