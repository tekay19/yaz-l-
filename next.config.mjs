/** @type {import('next').NextConfig} */
const nextConfig = {
  // self-hosting: `next build` emits a minimal server bundle in .next/standalone
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [
      {
        // the panel must never be indexed or framed
        source: '/panel',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
