"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowRight, Menu } from "lucide-react";
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from "@/lib/constants";

export default function HomepageNav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    setMobileOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <nav
      className={`backdrop-blur-lg border-b border-sky-200/60 sticky top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/95 shadow-lg shadow-sky-100/50"
          : "bg-white/80"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center h-16 py-1 gap-8">
          <div className="hidden md:flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => scrollToSection("features")}
              className="nav-underline text-gray-700 hover:text-[#199df4] transition-colors duration-200"
            >
              Features
            </Button>
            <Button
              variant="ghost"
              onClick={() => scrollToSection("pricing")}
              className="nav-underline text-gray-700 hover:text-[#199df4] transition-colors duration-200"
            >
              Pricing
            </Button>
            <Link href="/how-it-works">
              <Button
                variant="ghost"
                className="nav-underline text-gray-700 hover:text-[#199df4] transition-colors duration-200"
              >
                How It Works
              </Button>
            </Link>
          </div>

          <Link
            href="/"
            className="flex items-center justify-center shrink-0"
          >
            <Image
              src={DEFAULT_LOGO_SRC}
              alt={DEFAULT_LOGO_ALT}
              width={56}
              height={56}
              className="rounded-full"
              style={{ width: "56px", height: "56px" }}
              priority
            />
          </Link>

          <div className="hidden md:flex items-center space-x-4">
            <Link href="/membership">
              <Button
                variant="ghost"
                className="nav-underline text-gray-700 hover:text-[#199df4] transition-colors duration-200"
              >
                Membership
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                variant="ghost"
                className="nav-underline text-gray-700 hover:text-[#199df4] transition-colors duration-200"
              >
                Contact
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button
                variant="ghost"
                className="text-gray-700 hover:text-[#199df4]"
              >
                Sign In
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button
                variant="running_border"
                size="sm"
                className="glow-enhanced cta-aurora"
              >
                Get Started
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="md:hidden absolute right-4"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="
         bg-white">
          <SheetHeader>
            <SheetTitle className="text-left text-lg font-bold text-gray-900">
              Menu
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-2 mt-4">
            <Button
              variant="ghost"
              className="justify-start text-gray-700 hover:text-[#199df4]"
              onClick={() => scrollToSection("features")}
            >
              Features
            </Button>
            <Button
              variant="ghost"
              className="justify-start text-gray-700 hover:text-[#199df4]"
              onClick={() => scrollToSection("pricing")}
            >
              Pricing
            </Button>
            <Link href="/how-it-works" onClick={() => setMobileOpen(false)}>
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-700 hover:text-[#199df4]"
              >
                How It Works
              </Button>
            </Link>
            <Link href="/membership" onClick={() => setMobileOpen(false)}>
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-700 hover:text-[#199df4]"
              >
                Membership
              </Button>
            </Link>
            <Link href="/contact" onClick={() => setMobileOpen(false)}>
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-700 hover:text-[#199df4]"
              >
                Contact
              </Button>
            </Link>
            <div className="border-t border-gray-200 my-2" />
            <Link href="/auth/login" onClick={() => setMobileOpen(false)}>
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-700 hover:text-[#199df4]"
              >
                Sign In
              </Button>
            </Link>
            <Link href="/auth/signup" onClick={() => setMobileOpen(false)}>
              <Button
                variant="running_border"
                className="w-full glow-enhanced cta-aurora"
              >
                Get Started
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
