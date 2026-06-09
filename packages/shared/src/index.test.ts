import { describe, it, expect } from 'vitest';
import { APP_NAME, APP_VERSION } from './index.js';

describe('shared', () => {
  it('exports APP_NAME', () => {
    expect(APP_NAME).toBe('DRA');
  });

  it('exports APP_VERSION', () => {
    expect(APP_VERSION).toBe('0.1.0');
  });
});
