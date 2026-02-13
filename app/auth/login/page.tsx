"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from "@/lib/constants";
import { toast } from "sonner";
import { Gavel, ShieldCheck, Scale, ArrowLeft, Lock } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get("message");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      console.log('[Login] Starting login process...');
      
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('[Login] Auth response:', { authData, signInError });

      if (signInError) throw signInError;

      if (!authData.user) {
        throw new Error('No user data returned from sign in');
      }

      console.log('[Login] User signed in:', authData.user.id);

      // Get user role to redirect appropriately - retry a few times if profile doesn't exist yet
      let profile = null;
      let profileError = null;
      
      for (let i = 0; i < 3; i++) {
        const result = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .maybeSingle();
        
        profile = result.data;
        profileError = result.error;
        
        if (profile) break;
        
        // Wait a bit before retrying
        if (i < 2) {
          console.log('[Login] Profile not found, retrying...');
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log('[Login] Profile data:', { profile, profileError });

      if (!profile) {
        console.warn('[Login] Profile not found after retries, creating via API...');
        
        // Create profile using the API endpoint (has service role access)
        try {
          const createResponse = await fetch('/api/create-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: authData.user.id,
              email: authData.user.email || email,
              role: 'subscriber',
              fullName: authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0] || 'User'
            })
          });
          
          if (createResponse.ok) {
            console.log('[Login] Profile created successfully via API');
          } else {
            console.error('[Login] Failed to create profile via API:', await createResponse.text());
          }
        } catch (err) {
          console.error('[Login] Error calling create-profile API:', err);
        }
        
        // Default to subscriber dashboard
        console.log('[Login] Redirecting to default: /dashboard/letters');
        router.push('/dashboard/letters');
        router.refresh();
        return;
      }

      const roleRedirects: Record<string, string> = {
        'subscriber': '/dashboard/letters',
        'employee': '/dashboard/commissions',
        'admin': '/secure-admin-gateway/dashboard'
      };

      const redirectPath = roleRedirects[profile?.role || 'subscriber'];
      console.log('[Login] Redirecting to:', redirectPath);
      
      toast.success("Welcome back!");
      router.push(redirectPath);
      router.refresh();
    } catch (err: any) {
      console.error('[Login] Error:', err);

      const errorMessage = err?.message || '';
      let friendlyError = 'Failed to sign in';

      if (errorMessage.includes('Invalid login credentials')) {
        friendlyError = 'Incorrect email or password. Please check your credentials and try again.';
      } else if (errorMessage.includes('Email not confirmed')) {
        friendlyError = 'Please confirm your email address before signing in. Check your inbox for the confirmation link.';
      } else if (errorMessage.includes('Too many requests')) {
        friendlyError = 'Too many sign-in attempts. Please wait a moment and try again.';
      } else if (errorMessage.includes('Invalid email')) {
        friendlyError = 'Please enter a valid email address.';
      } else if (err instanceof Error) {
        friendlyError = err.message;
      }

      setError(friendlyError);
      toast.error(friendlyError);
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
            Secure Access to <span className="text-legal-gold italic">Legal Excellence</span>.
          </h2>
          <div className="space-y-8">
            {[
              { icon: Lock, title: "Secure Authentication", desc: "Your legal data is protected by bank-grade encryption and secure protocols." },
              { icon: ShieldCheck, title: "Confidentiality Guaranteed", desc: "We maintain strict attorney-client confidentiality for all correspondence." },
              { icon: Scale, title: "Professional Standards", desc: "Access your dashboard to manage attorney-reviewed legal documents." },
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
            <h1 className="text-4xl font-serif font-bold text-legal-navy mb-3">Welcome Back</h1>
            <p className="text-slate-500">Sign in to manage your legal correspondence.</p>
          </div>

          {message && (
            <div className="p-4 text-sm font-medium text-sky-700 bg-sky-50 border border-sky-100 rounded-lg">
              {message}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
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
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</Label>
                <Link href="/auth/forgot-password" title="Forgot Password" className="text-xs font-bold text-legal-navy hover:text-legal-gold transition-colors">
                  Forgot Password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                className="h-12 border-slate-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-14 text-lg font-bold btn-premium mt-4" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="text-center text-sm text-slate-500 pt-4">
            Don't have an account?{" "}
            <Link href="/auth/signup" className="font-bold text-legal-navy hover:text-legal-gold transition-colors">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
