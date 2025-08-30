import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { jest } from '@jest/globals';

// Polyfills for Node.js environment
Object.assign(global, { TextDecoder, TextEncoder });

// Mock crypto for Node.js environment
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },
    subtle: {
      generateKey: (jest.fn() as any).mockResolvedValue({
        type: 'secret',
        extractable: true,
        algorithm: { name: 'AES-GCM', length: 256 },
        usages: ['encrypt', 'decrypt']
      } as CryptoKey),
      importKey: (jest.fn() as any).mockResolvedValue({
        type: 'secret',
        extractable: true,
        algorithm: { name: 'AES-GCM', length: 256 },
        usages: ['encrypt', 'decrypt']
      } as CryptoKey),
      exportKey: (jest.fn() as any).mockResolvedValue(new ArrayBuffer(32)),
      encrypt: (jest.fn() as any).mockResolvedValue(new ArrayBuffer(64)),
      decrypt: (jest.fn() as any).mockResolvedValue(new ArrayBuffer(32)),
      digest: (jest.fn() as any).mockResolvedValue(new ArrayBuffer(32)),
      deriveKey: (jest.fn() as any).mockResolvedValue({
        type: 'secret',
        extractable: false,
        algorithm: { name: 'AES-GCM', length: 256 },
        usages: ['encrypt', 'decrypt']
      } as CryptoKey),
      deriveBits: (jest.fn() as any).mockResolvedValue(new ArrayBuffer(32))
    }
  }
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => {
      return store[key] || null;
    },
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: '/',
    search: '',
    hash: '',
    assign: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn()
  },
  writable: true
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root: Element | Document | null = null;
  rootMargin: string = '0px';
  thresholds: ReadonlyArray<number> = [0];
  
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.root = options?.root || null;
    this.rootMargin = options?.rootMargin || '0px';
    this.thresholds = options?.threshold ? (Array.isArray(options.threshold) ? options.threshold : [options.threshold]) : [0];
  }
  
  observe() {
    return null;
  }
  
  disconnect() {
    return null;
  }
  
  unobserve() {
    return null;
  }
  
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
};

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
  } as Response)
);

// Mock File and FileReader
global.File = class File {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  webkitRelativePath: string = '';
  
  constructor(chunks: any[], filename: string, options: any = {}) {
    this.name = filename;
    this.size = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    this.type = options.type || '';
    this.lastModified = options.lastModified || Date.now();
    this.webkitRelativePath = '';
  }
  
  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(this.size));
  }
  
  text() {
    return Promise.resolve('');
  }
  
  stream() {
    return new ReadableStream();
  }
  
  slice() {
    return new File([], this.name);
  }
  
  bytes() {
    return Promise.resolve(new Uint8Array(this.size));
  }
};

global.FileReader = class FileReader {
  static readonly EMPTY = 0;
  static readonly LOADING = 1;
  static readonly DONE = 2;
  
  readonly EMPTY = 0;
  readonly LOADING = 1;
  readonly DONE = 2;
  
  result: any = null;
  error: any = null;
  readyState: 0 | 1 | 2 = 0;
  onload: any = null;
  onerror: any = null;
  onabort: any = null;
  onloadstart: any = null;
  onloadend: any = null;
  onprogress: any = null;
  
  readAsText() {
    this.readyState = 2;
    this.result = '';
    if (this.onload) this.onload({ target: this });
  }
  
  readAsDataURL() {
    this.readyState = 2;
    this.result = 'data:text/plain;base64,';
    if (this.onload) this.onload({ target: this });
  }
  
  readAsArrayBuffer() {
    this.readyState = 2;
    this.result = new ArrayBuffer(0);
    if (this.onload) this.onload({ target: this });
  }
  
  readAsBinaryString() {
    this.readyState = 2;
    this.result = '';
    if (this.onload) this.onload({ target: this });
  }
  
  abort() {
    this.readyState = 2;
    if (this.onabort) this.onabort({ target: this });
  }
  
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
};

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock canvas
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Array(4) })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => ({ data: new Array(4) })),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  fillText: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  measureText: jest.fn(() => ({ width: 0 })),
  transform: jest.fn(),
  rect: jest.fn(),
  clip: jest.fn()
})) as any;

// Mock console methods for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
global.testUtils = {
  // Wait for next tick
  waitForNextTick: () => new Promise(resolve => setTimeout(resolve, 0)),
  
  // Wait for specific time
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Mock timer helpers
  mockTimers: () => {
    jest.useFakeTimers();
  },
  
  restoreTimers: () => {
    jest.useRealTimers();
  },
  
  // Mock date
  mockDate: (date: string | number | Date) => {
    const mockDate = new Date(date);
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
    return mockDate;
  },
  
  // Restore date
  restoreDate: () => {
    jest.restoreAllMocks();
  }
};

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveClass(className: string): R;
      toHaveStyle(style: Record<string, any>): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toHaveValue(value: any): R;
      toHaveTextContent(text: string): R;
    }
  }
  
  var testUtils: {
    waitForNextTick: () => Promise<void>;
    wait: (ms: number) => Promise<void>;
    mockTimers: () => void;
    restoreTimers: () => void;
    mockDate: (date: string | number | Date) => Date;
    restoreDate: () => void;
  };
}

export {};