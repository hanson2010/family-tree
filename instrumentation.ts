export async function register() {
  // This function is called once when the server starts
  // Load .env.local file only in Node.js runtime (not Edge Runtime)
  // This ensures GOOGLE_APPLICATION_CREDENTIALS is available for Google Cloud libraries
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV !== 'production') {
    const { config } = await import('dotenv');
    const { resolve } = await import('path');
    config({ path: resolve(process.cwd(), '.env.local') });
  }
}
