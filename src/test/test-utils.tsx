import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiConfig } from 'wagmi';
import { createConfig, http } from 'wagmi';
import { mainnet, polygon, bsc } from 'wagmi/chains';
import ErrorBoundary from '@/components/ErrorBoundary';

// Mock wagmi config for testing
const mockWagmiConfig = createConfig({
  chains: [mainnet, polygon, bsc],
  transports: {
    [mainnet.id]: http('https://test.ethereum.rpc'),
    [polygon.id]: http('https://test.polygon.rpc'),
    [bsc.id]: http('https://test.bsc.rpc')
  }
});

// Test wrapper component
interface TestWrapperProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
  wagmiConfig?: any;
}

function TestWrapper({ 
  children, 
  queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      },
      mutations: {
        retry: false
      }
    }
  }),
  wagmiConfig = mockWagmiConfig
}: TestWrapperProps) {
  return (
    <ErrorBoundary level="app">
      <QueryClientProvider client={queryClient}>
        <WagmiConfig config={wagmiConfig}>
          {children}
        </WagmiConfig>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Custom render function
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  wagmiConfig?: any;
  wrapper?: React.ComponentType<any>;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient,
    wagmiConfig,
    wrapper,
    ...renderOptions
  }: CustomRenderOptions = {}
): RenderResult & {
  user: ReturnType<typeof userEvent.setup>;
  queryClient: QueryClient;
} {
  const Wrapper = wrapper || TestWrapper;
  const testQueryClient = queryClient || new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      },
      mutations: {
        retry: false
      }
    }
  });

  const result = render(ui, {
    wrapper: (props) => (
      <Wrapper 
        queryClient={testQueryClient} 
        wagmiConfig={wagmiConfig}
        {...props} 
      />
    ),
    ...renderOptions
  });

  return {
    ...result,
    user: userEvent.setup(),
    queryClient: testQueryClient
  };
}

// Mock data generators
export const mockDataGenerators = {
  // Generate mock user
  user: (overrides: Partial<any> = {}) => ({
    id: 'test-user-' + Math.random().toString(36).substr(2, 9),
    address: '0x' + Math.random().toString(16).substr(2, 40),
    email: `test${Math.random().toString(36).substr(2, 5)}@example.com`,
    role: 'reporter',
    verified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }),

  // Generate mock report
  report: (overrides: Partial<any> = {}) => ({
    id: 'test-report-' + Math.random().toString(36).substr(2, 9),
    title: 'Test Report ' + Math.random().toString(36).substr(2, 5),
    description: 'This is a test report description',
    category: 'harassment',
    severity: 'medium',
    location: 'Test Location',
    date: new Date().toISOString(),
    reporter: 'test-reporter-id',
    status: 'pending',
    ipfsHash: 'Qm' + Math.random().toString(36).substr(2, 44),
    transactionHash: null,
    verified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }),

  // Generate mock file
  file: (overrides: Partial<any> = {}) => {
    const name = `test-file-${Math.random().toString(36).substr(2, 5)}.txt`;
    const content = 'Test file content';
    const size = content.length;
    
    return new File([content], name, {
      type: 'text/plain',
      lastModified: Date.now(),
      ...overrides
    });
  },

  // Generate mock blockchain transaction
  transaction: (overrides: Partial<any> = {}) => ({
    hash: '0x' + Math.random().toString(16).substr(2, 64),
    blockNumber: Math.floor(Math.random() * 1000000) + 10000000,
    blockHash: '0x' + Math.random().toString(16).substr(2, 64),
    transactionIndex: Math.floor(Math.random() * 100),
    from: '0x' + Math.random().toString(16).substr(2, 40),
    to: '0x' + Math.random().toString(16).substr(2, 40),
    gasUsed: '21000',
    gasPrice: '20000000000',
    status: 'success',
    timestamp: Date.now(),
    ...overrides
  }),

  // Generate mock IPFS response
  ipfsResponse: (overrides: Partial<any> = {}) => ({
    hash: 'Qm' + Math.random().toString(36).substr(2, 44),
    size: Math.floor(Math.random() * 10000) + 1000,
    url: `https://test.ipfs.io/ipfs/Qm${Math.random().toString(36).substr(2, 44)}`,
    pinned: true,
    timestamp: Date.now(),
    ...overrides
  })
};

// Test helpers
export const testHelpers = {
  // Wait for element to appear
  waitForElement: async (getElement: () => HTMLElement | null, timeout = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const element = getElement();
      if (element) return element;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Element not found within timeout');
  },

  // Wait for condition
  waitForCondition: async (condition: () => boolean, timeout = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (condition()) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Condition not met within timeout');
  },

  // Simulate file upload
  simulateFileUpload: async (input: HTMLInputElement, files: File[]) => {
    const user = userEvent.setup();
    await user.upload(input, files);
  },

  // Simulate form submission
  simulateFormSubmission: async (form: HTMLFormElement, data: Record<string, any>) => {
    const user = userEvent.setup();
    
    for (const [name, value] of Object.entries(data)) {
      const field = form.querySelector(`[name="${name}"]`) as HTMLInputElement;
      if (field) {
        if (field.type === 'checkbox' || field.type === 'radio') {
          if (value) {
            await user.click(field);
          }
        } else {
          await user.clear(field);
          await user.type(field, String(value));
        }
      }
    }
    
    await user.click(form.querySelector('[type="submit"]') as HTMLElement);
  },

  // Mock localStorage
  mockLocalStorage: () => {
    const store: Record<string, string> = {};
    return {
      getItem: jest.fn((key: string) => store[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
      }),
      clear: jest.fn(() => {
        Object.keys(store).forEach(key => delete store[key]);
      }),
      get length() {
        return Object.keys(store).length;
      },
      key: jest.fn((index: number) => {
        const keys = Object.keys(store);
        return keys[index] || null;
      })
    };
  },

  // Mock fetch responses
  mockFetch: (responses: Array<{ url?: string; response: any; status?: number }>) => {
    const mockFetch = jest.fn();
    
    responses.forEach(({ url, response, status = 200 }, index) => {
      const mockResponse = {
        ok: status >= 200 && status < 300,
        status,
        json: (jest.fn() as any).mockResolvedValue(response),
        text: (jest.fn() as any).mockResolvedValue(JSON.stringify(response)),
        blob: (jest.fn() as any).mockResolvedValue(new Blob([JSON.stringify(response)])),
        arrayBuffer: (jest.fn() as any).mockResolvedValue(new ArrayBuffer(0))
      };
      
      if (url) {
        (mockFetch as any).mockImplementation((fetchUrl: string) => {
          if (fetchUrl.includes(url)) {
            return Promise.resolve(mockResponse);
          }
          return Promise.reject(new Error(`Unexpected fetch to ${fetchUrl}`));
        });
      } else {
        (mockFetch as any).mockResolvedValueOnce(mockResponse);
      }
    });
    
    global.fetch = mockFetch as any;
    return mockFetch;
  },

  // Create mock error
  createMockError: (message: string, code?: string, cause?: any) => {
    const error = new Error(message);
    if (code) (error as any).code = code;
    if (cause) (error as any).cause = cause;
    return error;
  },

  // Mock console methods
  mockConsole: () => {
    const originalConsole = { ...console };
    const mockConsole = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    };
    
    Object.assign(console, mockConsole);
    
    return {
      mockConsole,
      restore: () => Object.assign(console, originalConsole)
    };
  }
};

// Custom matchers
export const customMatchers = {
  // Check if element has error state
  toHaveErrorState: (element: HTMLElement) => {
    const hasErrorClass = element.classList.contains('error') || 
                         element.classList.contains('invalid') ||
                         element.getAttribute('aria-invalid') === 'true';
    
    return {
      pass: hasErrorClass,
      message: () => hasErrorClass 
        ? `Expected element not to have error state`
        : `Expected element to have error state`
    };
  },

  // Check if element is loading
  toBeLoading: (element: HTMLElement) => {
    const isLoading = element.classList.contains('loading') ||
                     element.getAttribute('aria-busy') === 'true' ||
                     element.querySelector('.spinner, .loading') !== null;
    
    return {
      pass: isLoading,
      message: () => isLoading
        ? `Expected element not to be loading`
        : `Expected element to be loading`
    };
  }
};

// Re-export everything from testing-library
export * from '@testing-library/react';
export { userEvent };
export { renderWithProviders as render };