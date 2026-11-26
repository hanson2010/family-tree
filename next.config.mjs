import { readFileSync } from 'node:fs';

// The app's version, shown in the sidebar, from package.json at build time
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Externalize packages that use Node.js built-ins
  serverExternalPackages: [
    '@google-cloud/datastore',
    '@google-cloud/storage',
    '@google/genai',
  ],
};

export default nextConfig;
