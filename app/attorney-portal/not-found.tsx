import Link from 'next/link'
import { FileQuestion, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AttorneyPortalNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center">
            <FileQuestion className="h-8 w-8 text-[#199df4]" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">Page Not Found</h1>
        <p className="text-gray-600 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <Button variant="outline" asChild>
          <Link href="/attorney-portal/review">
            <ArrowLeft className="h-4 w-4" />
            Back to Review Queue
          </Link>
        </Button>
      </div>
    </div>
  )
}
