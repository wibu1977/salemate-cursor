const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tránh Next.js chọn nhầm lockfile ở thư mục cha khi build (Vercel/CI)
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "platform-lookaside.fbsbx.com" },
    ],
  },
  // /api/* do src/app/api/[...path]/route.ts proxy tới backend (đọc BACKEND_INTERNAL_URL lúc request).
  // Tránh rewrite bake http://127.0.0.1:8000 khi Railway build thiếu env.
};

module.exports = nextConfig;
