// Mock for wagmi library
module.exports = {
  WagmiConfig: ({ children }) => children,
  useAccount: () => ({
    address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
    isConnected: true,
    isConnecting: false,
    isDisconnected: false
  }),
  useConnect: () => ({
    connect: jest.fn(),
    connectors: [],
    isLoading: false,
    pendingConnector: null
  }),
  useDisconnect: () => ({
    disconnect: jest.fn()
  }),
  useNetwork: () => ({
    chain: { id: 1, name: 'Ethereum' },
    chains: [{ id: 1, name: 'Ethereum' }]
  }),
  useSwitchNetwork: () => ({
    switchNetwork: jest.fn(),
    isLoading: false
  }),
  useContractRead: () => ({
    data: null,
    isError: false,
    isLoading: false
  }),
  useContractWrite: () => ({
    write: jest.fn(),
    writeAsync: jest.fn(),
    isLoading: false,
    isSuccess: false,
    isError: false
  }),
  usePrepareContractWrite: () => ({
    config: {},
    isError: false,
    isLoading: false
  }),
  useWaitForTransaction: () => ({
    data: null,
    isError: false,
    isLoading: false,
    isSuccess: false
  }),
  createConfig: jest.fn(),
  configureChains: jest.fn(),
  mainnet: { id: 1, name: 'Ethereum' },
  polygon: { id: 137, name: 'Polygon' },
  bsc: { id: 56, name: 'BSC' }
};