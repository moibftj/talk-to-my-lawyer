"use client";

import dynamic from "next/dynamic";

const HomeContent = dynamic(() => import("./home-client"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-sky-50/40 to-blue-50/30 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#199df4] mx-auto mb-4"></div>
      </div>
    </div>
  ),
});

export default function Page() {
  return <HomeContent />;
}
