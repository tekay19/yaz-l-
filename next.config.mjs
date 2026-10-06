/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // heic-convert loads libheif as WASM through a dynamic require that the
  // bundler cannot follow; load it from node_modules at runtime like sharp.
  serverExternalPackages: ['heic-convert'],
  // the old order steps; links in e-mails and bookmarks land on the upload wizard
  async redirects() {
    return ['/paket', '/kagitlar', '/ozet', '/odeme'].map((source) => ({ source, destination: '/yukle', permanent: false }));
  },
  async headers() {
    return [
      {
        // the panel and its measurement screen must never be indexed or framed
        source: '/panel/:path*',
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
