/**
 * Next.js Configuration for Talk-To-My-Lawyer
 *
 * Production deployment optimizations:
 * - Standalone output for containerized deployments
 * - Strict TypeScript checking enforced
 * - Image optimization enabled for Supabase storage
 * - Security headers and CSP configured
 * - Extended timeouts for AI generation endpoints
 */
const replitDomains = [
  ...(process.env.REPLIT_DEV_DOMAIN ? [process.env.REPLIT_DEV_DOMAIN] : []),
  ...(process.env.REPLIT_DOMAINS ? process.env.REPLIT_DOMAINS.split(",") : []),
].filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for optimized Docker/container deployments
  output: "standalone",

  // TypeScript strict mode - DO NOT disable in production
  // If build errors occur, fix the underlying type issues
  typescript: {
    ignoreBuildErrors: false,
  },

  // Image optimization for Supabase storage and external sources
  images: {
    // Enable optimization for production (disabled in dev for faster builds)
    unoptimized: process.env.NODE_ENV !== "production",
    remotePatterns: [
      {
        protocol: "https",
        hostname:
          process.env.SUPABASE_HOSTNAME ||
          (() => {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
            try {
              return new URL(url).hostname;
            } catch {
              // Fallback to a valid hostname placeholder when URL is not configured
              return "supabase.co";
            }
          })(),
        pathname: "/storage/**",
      },
      // Add Stripe image domains for payment verification UI
      {
        protocol: "https",
        hostname: "files.stripe.com",
        pathname: "/links/**",
      },
      // Vercel analytics domains
      {
        protocol: "https",
        hostname: "vercel.live",
        pathname: "/**",
      },
    ],
    // Configure image quality and formats
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Experimental features for better performance
  experimental: {
    // Optimize package imports for smaller bundle size
    optimizePackageImports: [
      "@radix-ui/react-icons",
      "lucide-react",
      "recharts",
    ],
  },

  allowedDevOrigins: ["localhost", "127.0.0.1", ...replitDomains],
  async headers() {
    const headers = [];

    // Apply security headers to all routes
    headers.push({
      source: "/(.*)",
      headers: [
        {
          key: "X-DNS-Prefetch-Control",
          value: "on",
        },
        {
          key: "X-XSS-Protection",
          value: "1; mode=block",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "Referrer-Policy",
          value: "origin-when-cross-origin",
        },
        {
          key: "X-Permitted-Cross-Domain-Policies",
          value: "none",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
        },
      ],
    });

    // Additional strict headers for API routes
    headers.push({
      source: "/api/(.*)",
      headers: [
        {
          key: "Strict-Transport-Security",
          value:
            process.env.NODE_ENV === "production"
              ? "max-age=31536000; includeSubDomains; preload"
              : "max-age=0",
        },
        {
          key: "Content-Security-Policy",
          value:
            "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; frame-ancestors *;",
        },
      ],
    });

    // CSP headers are already applied via the '/:path*' pattern above
    // Stripe and Supabase CSP for non-API routes
    // Includes Resend email tracking, Vercel analytics, and Supabase auth domains
    headers.push({
      source: "/:path((?!api).*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value:
            process.env.NODE_ENV === "production"
              ? [
                  "default-src 'self';",
                  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://vercel.live;",
                  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
                  "font-src 'self' https://fonts.gstatic.com https://vercel.live;",
                  "img-src 'self' data: https: blob:;",
                  "connect-src 'self' https://api.stripe.com https://js.stripe.com https://*.supabase.co https://vercel.live https://resend.com;",
                  "frame-src 'self' https://js.stripe.com https://vercel.live;",
                  "frame-ancestors *;",
                  "base-uri 'self';",
                  "form-action 'self';",
                ].join(" ")
              : [
                  "default-src 'self';",
                  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://vercel.live;",
                  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
                  "font-src 'self' https://fonts.gstatic.com https://vercel.live;",
                  "img-src 'self' data: https: blob:;",
                  "connect-src 'self' https://api.stripe.com https://js.stripe.com https://*.supabase.co https://vercel.live https://resend.com ws://localhost:* ws://127.0.0.1:*;",
                  "frame-src 'self' https://js.stripe.com https://vercel.live;",
                  "frame-ancestors *;",
                  "base-uri 'self';",
                  "form-action 'self';",
                ].join(" "),
        },
      ],
    });

    // Cache control for static assets
    headers.push({
      source: "/_next/static/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    });

    // Cache control for images
    headers.push({
      source: "/images/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=86400, s-maxage=86400",
        },
      ],
    });

    return headers;
  },
};

export default nextConfig;
