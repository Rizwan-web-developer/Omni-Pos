/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Ensure Prisma's native query engine ships with the serverless bundle on Vercel.
    // Without this, Next.js file tracing can miss the .so.node binary and runtime fails with
    // "Prisma Client could not locate the Query Engine for runtime rhel-openssl-3.0.x".
    outputFileTracingIncludes: {
      "/**/*": ["./node_modules/.prisma/client/**/*"],
    },
  },
};

export default nextConfig;
