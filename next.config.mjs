const isProd = process.env.NODE_ENV === 'production';

// Everything the pages load comes from this site: scripts, styles, fonts
// (next/font serves them locally), photos (blob: previews while uploading).
// The payment page is a full navigation to iyzico, which CSP does not
// restrict. Next's inline bootstrap needs 'unsafe-inline' for scripts; dev
// mode also needs 'unsafe-eval'.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isProd ? '' : ' ws:'}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // heic-convert loads libheif as WASM through a dynamic require that the
  // bundler cannot follow; load it from node_modules at runtime like sharp.
  serverExternalPackages: ['heic-convert'],
  // the old order steps; links in e-mails and bookmarks land on the upload wizard
  async redirects() {
    return [
      ...['/paket', '/kagitlar', '/ozet', '/odeme'].map((source) => ({ source, destination: '/yukle', permanent: false })),
      { source: '/hata', destination: '/', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        // the admin panel must never be indexed, framed or cached
        source: '/admin/:path*',
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
          // nothing of ours is ever shown inside another site's frame
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
