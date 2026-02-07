"use client"

import Image from "next/image"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Settings, LogOut, User } from "lucide-react"
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from "@/lib/constants"

interface AdminHeaderProps {
  user: {
    id: string
    full_name: string | null
    email: string
    role: string
  }
}

export function AdminHeader({ user }: AdminHeaderProps) {
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = "/auth/login"
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Image
            src={DEFAULT_LOGO_SRC}
            alt={DEFAULT_LOGO_ALT}
            width={48}
            height={48}
            className="h-12 w-12 rounded-full logo-badge"
            priority
          />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Center</h1>
            <p className="text-sm text-gray-500">TalkToMyLawyer.com Administration</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user.full_name || user.email}</p>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">Admin</Badge>
              <span className="text-xs text-gray-500">{user.email}</span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" alt={user.full_name || user.email} />
                  <AvatarFallback>
                    {(user.full_name || user.email).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
