"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from "@/lib/constants";
import { Shield, Scale, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Standard Supabase auth - no custom JWT, no portal ID, no session key
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error("Authentication failed");
      }

      // Verify admin role from profiles table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, admin_sub_role")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error("User profile not found. Please contact support.");
      }

      if (profile.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error(
          "Access denied. Administrator privileges required. If you are a subscriber, please use the regular login page."
        );
      }

      // Determine redirect based on admin sub-role
      const subRole = profile.admin_sub_role || "super_admin";

      if (subRole === "attorney_admin") {
        router.push("/attorney-portal/review");
      } else {
        router.push("/secure-admin-gateway/dashboard");
      }
      router.refresh();
    } catch (err: any) {
      console.error("[AdminLogin] Error:", err);

      const errorMessage = err?.message || "";
      let friendlyError = "Failed to sign in";

      if (errorMessage.includes("Invalid login credentials")) {
        friendlyError =
          "Incorrect email or password. Please check your credentials and try again.";
      } else if (errorMessage.includes("Email not confirmed")) {
        friendlyError =
          "Please confirm your email address before signing in.";
      } else if (errorMessage.includes("Too many requests")) {
        friendlyError =
          "Too many sign-in attempts. Please wait a moment and try again.";
      } else if (errorMessage.includes("Access denied")) {
        friendlyError = errorMessage;
      } else if (errorMessage.includes("User profile not found")) {
        friendlyError = errorMessage;
      } else if (err instanceof Error) {
        friendlyError = err.message;
      }

      setError(friendlyError);
      toast.error(friendlyError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <title>Admin Login - Talk-to-my-Lawyer</title>
      <Card className="w-full max-w-md border-slate-700 bg-slate-800/50 backdrop-blur">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Image
              src={DEFAULT_LOGO_SRC}
              alt={DEFAULT_LOGO_ALT}
              width={150}
              height={150}
              className="h-38 w-38 rounded-full logo-badge"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold text-center text-white">
            Admin Portal
          </CardTitle>
          <CardDescription className="text-center text-slate-400">
            Sign in with your admin credentials
          </CardDescription>
          <div className="flex items-center justify-center gap-4 pt-2">
            <div className="flex items-center gap-1 text-xs text-red-400">
              <Shield className="w-3 h-3" />
              <span>Super Admin</span>
            </div>
            <div className="text-slate-600">|</div>
            <div className="flex items-center gap-1 text-xs text-blue-400">
              <Scale className="w-3 h-3" />
              <span>Attorney Admin</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@talk-to-my-lawyer.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-200">
                  Password
                </Label>
                <Link
                  href="/secure-admin-gateway/forgot-password"
                  className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-slate-700/50 border-slate-600 text-white"
              />
            </div>

            {error && (
              <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-900/50 rounded-md flex items-center gap-2">
                <svg
                  className="w-5 h-5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full text-white bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </Button>

            <div className="mt-4 text-center">
              <Link
                href="/"
                className="text-sm text-slate-400 hover:text-slate-300 inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to Home
              </Link>
            </div>
            <div className="pt-4 border-t border-slate-700 mt-4">
              <p className="text-xs text-center text-slate-500 flex items-center justify-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Secure admin access • All actions are logged
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
