import '@testing-library/jest-dom';

// Mock requestIdleCallback for tests
if (!window.requestIdleCallback) {
  window.requestIdleCallback = (callback: () => void) => {
    return setTimeout(callback, 0);
  };
}