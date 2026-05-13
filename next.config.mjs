/** @type {import('next').NextConfig} */

// ── Content Security Policy ─────────────────────────────────────────────
// Mitiga XSS bloqueando scripts/fetches a dominios no autorizados.
// Notas:
// - script-src tiene 'unsafe-inline' porque Next.js 14 App Router usa scripts
//   inline para hidratacion. Quitarlo requiere migrar a strict-dynamic + nonces
//   (refactor mayor). Mantenemos 'unsafe-inline' pero bloqueamos 'unsafe-eval'
//   que es el vector mas comun de XSS practico.
// - connect-src incluye el backend (Railway) via NEXT_PUBLIC_API_URL + 'self'.
//   El protocolo ws/wss tambien permitido para el chat de tickets.
// - img-src permite Google/GitHub avatares y onnix.com.py (logo del portal).
// - frame-ancestors 'none' previene clickjacking (no se puede embed en iframe).

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiHost = (() => {
  try {
    return new URL(apiUrl).origin;
  } catch {
    return 'http://localhost:3001';
  }
})();
// WebSocket origin (mismo host, distinto protocolo)
const wsHost = apiHost.replace(/^http/, 'ws');

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://onnix.com.py`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiHost} ${wsHost}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
];

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: cspDirectives.join('; '),
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'onnix.com.py',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
