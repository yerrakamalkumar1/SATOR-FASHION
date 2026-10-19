import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  ...(process.env.SATOR_TARGET === 'node' ? {
    output: 'standalone' as const,
    env: { NEXT_PUBLIC_SATOR_SELF_HOSTED: 'true' },
    outputFileTracingIncludes: { '/*': ['./drizzle/*.sql'] },
    webpack(config, { webpack, isServer }) {
      if (isServer) config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^cloudflare:workers$/, path.resolve('runtime/node.mjs')));
      return config;
    },
  } : {}),
};

export default nextConfig;
