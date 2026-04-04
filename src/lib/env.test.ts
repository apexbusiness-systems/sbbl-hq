import { describe, it, expect } from 'vitest';
import { readClientEnv, readServerEnv, safeServerEnv } from './env';

describe('env variables validation', () => {
  describe('readClientEnv', () => {
    it('returns default values when no matching env vars are provided', () => {
      const result = readClientEnv({});
      expect(result.VITE_APP_NAME).toBe('SBBL HQ');
      expect(result.VITE_DEFAULT_LEAGUE).toBe('SBBL');
      expect(result.VITE_DEFAULT_PPV_PRICE).toBe(2.5);
      expect(result.VITE_PUBLIC_BASE_URL).toBe('http://localhost:5173');
    });

    it('overrides default values with valid input', () => {
      const result = readClientEnv({
        VITE_APP_NAME: 'Custom App',
        VITE_DEFAULT_LEAGUE: 'WBL',
        VITE_DEFAULT_PPV_PRICE: '5.99', // Coerced to number
        VITE_PUBLIC_BASE_URL: 'https://example.com',
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'some-publishable-key-here',
      });

      expect(result.VITE_APP_NAME).toBe('Custom App');
      expect(result.VITE_DEFAULT_LEAGUE).toBe('WBL');
      expect(result.VITE_DEFAULT_PPV_PRICE).toBe(5.99);
      expect(result.VITE_PUBLIC_BASE_URL).toBe('https://example.com');
      expect(result.VITE_SUPABASE_URL).toBe('https://example.supabase.co');
      expect(result.VITE_SUPABASE_PUBLISHABLE_KEY).toBe('some-publishable-key-here');
    });

    it('throws when invalid VITE_DEFAULT_LEAGUE is provided', () => {
      expect(() => {
        readClientEnv({ VITE_DEFAULT_LEAGUE: 'INVALID' });
      }).toThrow();
    });

    it('throws when invalid VITE_PUBLIC_BASE_URL is provided', () => {
      expect(() => {
        readClientEnv({ VITE_PUBLIC_BASE_URL: 'not-a-url' });
      }).toThrow();
    });

    it('throws when VITE_DEFAULT_PPV_PRICE is negative', () => {
      expect(() => {
        readClientEnv({ VITE_DEFAULT_PPV_PRICE: -10 });
      }).toThrow();
    });
  });

  describe('readServerEnv', () => {
    it('returns parsed environment when valid required values are provided', () => {
      const result = readServerEnv({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'super-secret-service-role-key',
      });

      expect(result.SUPABASE_URL).toBe('https://example.supabase.co');
      expect(result.SUPABASE_SERVICE_ROLE_KEY).toBe('super-secret-service-role-key');
    });

    it('throws when required values are missing', () => {
      expect(() => {
        readServerEnv({
          SUPABASE_SERVICE_ROLE_KEY: 'super-secret-service-role-key',
        });
      }).toThrow();

      expect(() => {
        readServerEnv({
          SUPABASE_URL: 'https://example.supabase.co',
        });
      }).toThrow();
    });

    it('throws when invalid SUPABASE_URL is provided', () => {
      expect(() => {
        readServerEnv({
          SUPABASE_URL: 'not-a-url',
          SUPABASE_SERVICE_ROLE_KEY: 'super-secret-service-role-key',
        });
      }).toThrow();
    });

    it('throws when SUPABASE_SERVICE_ROLE_KEY is too short', () => {
      expect(() => {
        readServerEnv({
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'short',
        });
      }).toThrow();
    });
  });

  describe('safeServerEnv', () => {
    it('returns ok: true with value when valid environment is provided', () => {
      const result = safeServerEnv({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'super-secret-service-role-key',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.SUPABASE_URL).toBe('https://example.supabase.co');
        expect(result.value.SUPABASE_SERVICE_ROLE_KEY).toBe('super-secret-service-role-key');
      }
    });

    it('returns ok: false with missing paths when invalid environment is provided', () => {
      const result = safeServerEnv({
        SUPABASE_SERVICE_ROLE_KEY: 'super-secret-service-role-key',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.missing).toContain('SUPABASE_URL');
      }
    });
  });
});
