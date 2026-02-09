import Link from 'next/link'
import { FileQuestion, Home, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/40 to-blue-50/30 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center">
            <FileQuestion className="h-8 w-8 text-[#199df4]" />
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-4">
          <Scale className="h-5 w-5 text-[#199df4]" />
          <span className="text-sm font-semibold text-[#199df4]">Talk-to-my-Lawyer</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-3">Page Not Found</h1>
        <p className="text-gray-600 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <Button asChild>
          <Link href="/">
            <Home className="h-4 w-4" />
            Go Home
          </Link>
        </Button>
      </div>
    </div>
  )
}
