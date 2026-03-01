/**
 * Vitest Setup File
 *
 * Runs before all tests to set up the test environment
 */

import { expect, afterEach } from 'vitest';
import '@testing-library/jest-dom';

// Extended matchers from @testing-library/jest-dom
// are automatically available through the import above

// Global cleanup after each test
afterEach(() => {
  // Any global cleanup can go here
});

// Add custom matchers if needed
expect.extend({
  // Example custom matcher (not currently used):
  // toBeWithinRange(received: number, floor: number, ceiling: number) {
  //   const pass = received >= floor && received <= ceiling;
  //   if (pass) {
  //     return {
  //       message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
  //       pass: true,
  //     };
  //   } else {
  //     return {
  //       message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
  //       pass: false,
  //     };
  //   }
  // },
});
