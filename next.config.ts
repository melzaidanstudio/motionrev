import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Let the dev server be used from a phone or another laptop on the home network (http://192.168.x.x:3000);
  // without this Next blocks its dev scripts there and no button on the page works.
  allowedDevOrigins: ["192.168.*.*"],
  // better-sqlite3 is a native module; it must be required by Node, not bundled.
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
