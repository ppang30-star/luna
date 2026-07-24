/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // All menu images are streamed as raw bytes through a custom <img> tag
    // (see /api/menu/image/[id]), so next/image optimization is not used.
    unoptimized: true,
  },
}

export default nextConfig
