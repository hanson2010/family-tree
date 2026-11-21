/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
