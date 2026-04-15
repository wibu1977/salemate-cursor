import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-white">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900">
          Sale<span className="text-primary-600">mate</span>
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Tự động hóa bán hàng qua Messenger & Instagram
          <br />
          cho các hộ kinh doanh tại Hàn Quốc
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/login" className="btn-primary px-8 py-3 text-base">
            Đăng nhập
          </Link>
          <Link href="/dashboard" className="btn-secondary px-8 py-3 text-base">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
