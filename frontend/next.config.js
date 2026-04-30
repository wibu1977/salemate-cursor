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
  async rewrites() {
    let backendUrl = (process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    
    // Đảm bảo có protocol (http/https) để Next.js không báo lỗi "destination does not start with..."
    if (backendUrl && !backendUrl.startsWith("http://") && !backendUrl.startsWith("https://") && !backendUrl.startsWith("/")) {
      backendUrl = `http://${backendUrl}`;
    }

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
