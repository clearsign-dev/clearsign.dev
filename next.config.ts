import type { NextConfig } from "next";

// A static site: `npm run build` writes plain files to out/, which any static
// host can serve. There is no server and nothing runs at request time.
//
// BASE_PATH is set by the deploy workflow from what GitHub Pages reports. On
// <org>.github.io/clearsign.dev/ it is "/clearsign.dev", and without it every
// script and stylesheet on the page 404s. On a custom domain it is empty and
// the paths are already right. Leaving it to the workflow means the site does
// not need editing when the domain is bought.
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
