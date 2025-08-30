// Mock for viem library
module.exports = {
  createPublicClient: jest.fn(() => ({
    readContract: jest.fn(),
    getBalance: jest.fn(),
    getBlockNumber: jest.fn(),
    getTransaction: jest.fn(),
    waitForTransactionReceipt: jest.fn()
  })),
  createWalletClient: jest.fn(() => ({
    writeContract: jest.fn(),
    sendTransaction: jest.fn(),
    signMessage: jest.fn()
  })),
  http: jest.fn(),
  parseEther: jest.fn((value) => BigInt(value) * BigInt(10 ** 18)),
  formatEther: jest.fn((value) => (Number(value) / 10 ** 18).toString()),
  parseUnits: jest.fn(),
  formatUnits: jest.fn(),
  getAddress: jest.fn((address) => address),
  isAddress: jest.fn(() => true),
  encodeFunctionData: jest.fn(),
  decodeFunctionResult: jest.fn(),
  keccak256: jest.fn(),
  toHex: jest.fn(),
  fromHex: jest.fn(),
  mainnet: {
    id: 1,
    name: 'Ethereum',
    network: 'homestead',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: ['https://eth.llamarpc.com'] } }
  },
  polygon: {
    id: 137,
    name: 'Polygon',
    network: 'matic',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: { default: { http: ['https://polygon.llamarpc.com'] } }
  },
  bsc: {
    id: 56,
    name: 'BNB Smart Chain',
    network: 'bsc',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: { default: { http: ['https://bsc.llamarpc.com'] } }
  }
};