/** @type {import('next').NextConfig} */
const nextConfig = {
  // Reduce verbose logging in development
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  // Disable React strict mode to reduce double renders
  reactStrictMode: false,
  serverExternalPackages: ['whatsapp-web.js', 'qrcode-terminal'],
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  }
};

export default nextConfig;
