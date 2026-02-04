// Placeholder encryption module - would use AES-256-GCM in production

const PLACEHOLDER_KEY = 'secure-key-placeholder';

export function encrypt(plaintext: string): string {
  // TODO: implement real encryption with Web Crypto API
  void PLACEHOLDER_KEY;
  return `[ENCRYPTED]${plaintext}`;
}

export function decrypt(ciphertext: string): string {
  if (ciphertext.startsWith('[ENCRYPTED]')) {
    return ciphertext.slice(11);
  }
  return ciphertext;
}

export function sanitizeForLogging<T extends Record<string, unknown>>(
  data: T,
  sensitiveFields: (keyof T)[] = []
): Partial<T> {
  const sanitized = { ...data };
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]' as T[keyof T];
    }
  }
  return sanitized;
}

export const secureLog = {
  info: (message: string, data?: Record<string, unknown>) => {
    if (data) {
      const sanitized = sanitizeForLogging(data, ['body', 'content', 'password', 'key', 'token'] as never[]);
      console.log(`[INFO] ${message}`, sanitized);
    } else {
      console.log(`[INFO] ${message}`);
    }
  },
  error: (message: string, error?: Error) => {
    console.error(`[ERROR] ${message}`, error?.message, error?.stack);
  },
  debug: (message: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`);
    }
  },
};

export default { encrypt, decrypt, sanitizeForLogging, secureLog };
