/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  skipTrailingSlashRedirect: true,
  trailingSlash: false,
  // Skip generating static error pages during build
  generateBuildId: () => 'build-id',
  experimental: {
    optimizeCss: false,
  },
  // Avoid static optimization issues
  output: 'export',
  distDir: 'out',
};

export default nextConfig;
