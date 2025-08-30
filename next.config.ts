import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Enable modern image formats
    formats: ['image/webp', 'image/avif'],
    
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    
    // Image sizes for different breakpoints
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    
    // IPFS and external domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.ipfs.w3s.link',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'w3s.link',
        port: '',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
        port: '',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
        port: '',
        pathname: '/ipfs/**',
      }
    ],
    
    // Enable optimization
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react']
  }
};

export default nextConfig;
