// Jest setup file for React Native testing
import '@testing-library/react-native/extend-expect';

// Set NODE_ENV to development for tests
process.env.NODE_ENV = 'development';
global.__DEV__ = true;

// Mock platform
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'android',
  select: (obj) => obj.android,
}));

// Mock Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

// Mock Supabase
jest.mock('@brickshare/shared', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      refreshSession: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
    functions: {
      invoke: jest.fn(),
    },
  },
  supabaseLocal: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

// Mock expo-location
jest.mock('expo-location', () => ({
  useForegroundPermissions: () => [
    { granted: true },
    jest.fn(),
  ],
  Accuracy: {
    High: 1,
  },
  watchPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

// Suppress console warnings in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning:') || args[0].includes('Non-serializable'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('Warning:')) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});