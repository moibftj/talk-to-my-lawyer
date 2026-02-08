"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("id", user.id)
          .single();

        if (profile) {
          if (profile.role === "subscriber") {
            router.push("/dashboard/letters");
          } else if (profile.role === "admin") {
            router.push("/secure-admin-gateway/dashboard");
          } else if (profile.role === "employee") {
            router.push("/dashboard/commissions");
          }
        }
      }
    };

    checkAuth();
  }, [router]);

  return null;
}
