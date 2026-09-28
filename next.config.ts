import type { NextConfig } from "next";

// A static site: `npm run build` writes plain files to out/, which any static
// host can serve. There is no server and nothing runs at request time.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
