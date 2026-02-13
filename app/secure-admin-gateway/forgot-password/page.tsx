"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export const dynamic = 'force-dynamic';

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        throw error;
      }

      setSubmitted(true);
      toast.success("Password reset link sent to your email");
    } catch (err: any) {
      console.error("[AdminForgotPassword] Error:", err);

      const errorMessage = err?.message || "";
      let friendlyError = "Failed to send reset email";

      if (
        errorMessage.includes("User not found") ||
        errorMessage.includes("not found")
      ) {
        friendlyError =
          "No account found with this email address. Please check and try again.";
      } else if (
        errorMessage.includes("rate limit") ||
        errorMessage.includes("too many")
      ) {
        friendlyError =
          "Too many attempts. Please wait a moment and try again.";
      } else if (errorMessage.includes("Invalid email")) {
        friendlyError = "Please enter a valid email address.";
      } else if (err instanceof Error) {
        friendlyError = err.message;
      }

      toast.error(friendlyError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <title>Forgot Password - Admin Portal</title>
      <Card className="w-full max-w-md border-slate-700 bg-slate-800/50 backdrop-blur">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Image
              src={DEFAULT_LOGO_SRC}
              alt={DEFAULT_LOGO_ALT}
              width={120}
              height={120}
              className="h-28 w-28 rounded-full logo-badge"
              priority
            />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Link
              href="/secure-admin-gateway/login"
              className="text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <CardTitle className="text-2xl font-bold text-white">
              Forgot Password?
            </CardTitle>
          </div>
          <CardDescription className="text-slate-400">
            Enter your admin email address and we&apos;ll send you a link to
            reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Reset Link
                  </>
                )}
              </Button>
              <div className="text-center">
                <Link
                  href="/secure-admin-gateway/login"
                  className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Remember your password? Sign in
                </Link>
              </div>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Check Your Email
                </h3>
                <p className="text-slate-400 mb-4">
                  We&apos;ve sent a password reset link to your email address.
                  Please check your inbox and follow the instructions.
                </p>
                <p className="text-sm text-slate-500">
                  Don&apos;t see the email? Check your spam folder or try again.
                </p>
              </div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={() => setSubmitted(false)}
                >
                  Try Again
                </Button>
                <Link href="/secure-admin-gateway/login">
                  <Button
                    variant="ghost"
                    className="w-full text-slate-400 hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
