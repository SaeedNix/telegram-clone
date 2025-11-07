import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  
  // React 19: Enable React Compiler for automatic optimization
  experimental: {
    reactCompiler: true,     // React 19: Enable React Compiler
    // Note: dynamicIO is canary-only, removed for stability
  },
  
  // Optimize images with Next.js 15 features
  images: {
    // Next.js 15: Enable AVIF format for better compression
    formats: ['image/avif', 'image/webp'],
    // Optimize image loading
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.vercel.app",
      },
      {
        protocol: "https",
        hostname: "storage.c2.liara.space",
        port: "",
        pathname: "/tlgrm/**",
      },
    ],
  },
  
  // Optimize bundle size and loading
  productionBrowserSourceMaps: false,
  
  // Webpack optimizations
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
  },
};

export default nextConfig;
