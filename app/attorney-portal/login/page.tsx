"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Attorney Portal Login - Redirects to unified admin login
 * Attorneys should use the unified admin login at /secure-admin-gateway/login
 * and select "Attorney Admin" from the dropdown
 */
export default function AttorneyLoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to unified admin login
    router.replace("/secure-admin-gateway/login");
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <title>Attorney Admin Login - Talk-to-my-Lawyer</title>
      <div className="text-center text-slate-400">
        <p>Redirecting to admin login...</p>
      </div>
    </main>
  );
}
