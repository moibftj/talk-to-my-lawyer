"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from "@/lib/constants";
import { toast } from "sonner";
import { Gavel, ShieldCheck, Scale, ArrowLeft } from "lucide-react";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"subscriber" | "employee">("subscriber");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const getSupabase = () => {
    try {
      return createClient();
    } catch (err) {
      setError("Application not properly configured. Please contact support.");
      return null;
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://www.talk-to-my-lawyer.com" ||
        (typeof window !== "undefined"
          ? window.location.origin
          : "https://www.talk-to-my-lawyer.com");

      const roleRedirects: Record<string, string> = {
        subscriber: "/dashboard/letters",
        employee: "/dashboard/commissions",
      };

      const redirectUrl = `${baseUrl}${roleRedirects[role]}`;

      const { data: authData, error: signUpError } = await supabase.auth.signUp(
        {
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: fullName,
              role: role,
            },
          },
        },
      );

      if (signUpError) throw signUpError;

      if (authData.session) {
        toast.success("Account created! Redirecting to dashboard...");
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.success("Account created! Check your email.");
        router.push("/auth/check-email");
      }
    } catch (err: any) {
      const errorMessage = err.message || "Failed to create account. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* Left Side: Visual/Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-legal-navy relative overflow-hidden p-12 flex-col justify-between">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
        </div>
        
        <Link href="/" className="relative z-10 flex items-center gap-3 group">
          <div className="bg-white p-1.5 rounded-full shadow-lg transition-transform group-hover:scale-110">
            <Image
              src={DEFAULT_LOGO_SRC}
              alt={DEFAULT_LOGO_ALT}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full"
            />
          </div>
          <span className="text-2xl font-serif font-bold text-white tracking-tight">Talk-to-my-Lawyer</span>
        </Link>

        <div className="relative z-10 max-w-lg">
          <h2 className="text-5xl font-serif font-bold text-white mb-8 leading-tight">
            Professional <span className="text-legal-gold italic">Legal Authority</span> Simplified.
          </h2>
          <div className="space-y-8">
            {[
              { icon: ShieldCheck, title: "Attorney Reviewed", desc: "Every letter is meticulously checked by licensed legal professionals." },
              { icon: Gavel, title: "Legally Authoritative", desc: "Our correspondence carries the weight of professional legal drafting." },
              { icon: Scale, title: "Fair & Transparent", desc: "Fixed pricing with no hidden fees or complex legal retainers." },
            ].map((item, i) => (
              <div key={i} className="flex gap-6 animate-fade-in" style={{ animationDelay: `${i * 200}ms` }}>
                <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-6 w-6 text-legal-gold" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg mb-1">{item.title}</h3>
                  <p className="text-sky-100/60 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 pt-12 border-t border-white/10">
          <p className="text-sky-100/40 text-xs uppercase tracking-widest font-bold">
            Trusted by 10,000+ Professionals Nationwide
          </p>
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-slate-50 lg:bg-white">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="lg:hidden flex justify-center mb-8">
            <Image
              src={DEFAULT_LOGO_SRC}
              alt={DEFAULT_LOGO_ALT}
              width={80}
              height={80}
              className="h-20 w-20 rounded-full logo-badge"
            />
          </div>

          <div className="text-center lg:text-left">
            <Link href="/" className="inline-flex items-center text-sm font-bold text-slate-400 hover:text-legal-navy mb-6 transition-colors group">
              <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Back to Home
            </Link>
            <h1 className="text-4xl font-serif font-bold text-legal-navy mb-3">Create Account</h1>
            <p className="text-slate-500">Join the premium platform for professional legal correspondence.</p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                className="h-12 border-slate-200 focus:border-legal-navy focus:ring-legal-navy/10"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="h-12 border-slate-200 focus:border-legal-navy focus:ring-legal-navy/10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-xs font-bold uppercase tracking-wider text-slate-500">Account Type</Label>
              <Select value={role} onValueChange={(value: any) => setRole(value)}>
                <SelectTrigger className="h-12 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscriber">Subscriber - Generate Letters</SelectItem>
                  <SelectItem value="employee">Employee - Earn Commissions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</Label>
                <PasswordInput
                  id="password"
                  className="h-12 border-slate-200"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider text-slate-500">Confirm</Label>
                <PasswordInput
                  id="confirmPassword"
                  className="h-12 border-slate-200"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="p-4 text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-14 text-lg font-bold btn-premium mt-4" disabled={loading}>
              {loading ? "Creating Account..." : "Sign Up"}
            </Button>
          </form>

          <div className="text-center text-sm text-slate-500 pt-4">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-bold text-legal-navy hover:text-legal-gold transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
