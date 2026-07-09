import type { NextConfig } from "next";

// Si tu API está en otro puerto (ej. 4000), define NEXT_PUBLIC_API_URL en .env.local
const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const backendOrigin = apiBase.replace(/\/api\/?$/, "");

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      // Proxy /storage/* al backend para evitar ERR_BLOCKED_BY_RESPONSE.NotSameOrigin
      {
        source: "/storage/:path*",
        destination: `${backendOrigin}/storage/:path*`,
      },
    ];
  },
};

export default nextConfig;
