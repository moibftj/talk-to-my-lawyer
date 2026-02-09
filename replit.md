# Talk-To-My-Lawyer

### Overview
Talk-To-My-Lawyer is a Next.js web application designed to provide users with professional, lawyer-drafted legal letters for common scenarios such as breach of contract, demand for payment, and cease and desist orders. The platform streamlines the process of obtaining legal documents, offering attorney-reviewed letters for a fee of $50, which includes a PDF download. The project aims to make legal document creation accessible and efficient.

### User Preferences
I want iterative development. Ask before making major changes. I prefer detailed explanations. Do not make changes to the folder `lib/email/templates`. Do not make changes to the file `components/ui/form-stepper.tsx`.

### System Architecture
The application is built with Next.js 16.x using the App Router and TypeScript. Styling is handled by Tailwind CSS 4.x with Radix UI components for a modern and responsive interface.

**UI/UX Decisions:**
- **Design System**: Radix UI components are used for a consistent and accessible UI.
- **Responsiveness**: Mobile navigation utilizes a hamburger menu with a Sheet component.
- **Animations**: Subtle animations like button press feedback, card hover effects, nav underline slides, input focus glows, scroll-reveal fade-ins, status badge shimmers, and CTA glow pulses are implemented with `prefers-reduced-motion` accessibility support.
- **Homepage**: Server-Side Rendered (SSR) for SEO, featuring sections like Hero, Stats, Letter Types, Testimonials, Pricing, Features, FAQ, and Footer.
- **Toasts**: `sonner` Toaster is integrated for user notifications across the application.
- **Form Stepper**: A 3-step progress stepper (`components/ui/form-stepper.tsx`) guides users through the letter creation process.
- **Error Boundaries**: Branded `error.tsx` pages at root, `/dashboard`, `/secure-admin-gateway`, and `/attorney-portal` levels catch crashes gracefully with "Try Again" buttons and navigation links.
- **404 Pages**: Custom `not-found.tsx` pages at root, `/dashboard`, `/secure-admin-gateway`, and `/attorney-portal` levels.
- **Loading States**: Skeleton-based `loading.tsx` pages for all dashboard sub-pages (letters, billing, subscription, settings, commissions, referrals, payouts, coupons, employee-settings) and attorney-portal review pages.
- **Middleware**: `middleware.ts` at project root delegates to `lib/supabase/proxy.ts` for route protection, session refresh, and role-based redirects.
- **SEO**: `app/robots.ts` and `app/sitemap.ts` for search engine optimization. Page-specific metadata on homepage, how-it-works, FAQ, membership, and contact pages. JSON-LD structured data (LegalService schema) on homepage.

**Technical Implementations & Feature Specifications:**
- **Authentication**: Supabase Auth manages user accounts, complemented by JWT-signed sessions for admin portals.
- **Database**: Supabase (PostgreSQL) serves as the primary data store.
- **Payments**: Stripe integration, managed via the Replit Connector, handles all payment processing.
- **AI Letter Generation**: n8n workflow is the ONLY generation method, incorporating jurisdiction-specific research using GPT-4o. No OpenAI fallback.
- **Email Service**: Resend is used for sending templated emails, queued for efficient delivery.
- **Rate Limiting**: Upstash Redis is implemented for API rate limiting.
- **Admin Portals**: A dual-portal system exists:
    - **Super Admin Gateway**: Provides full system access (analytics, users, coupons, commissions, letter review).
    - **Attorney Portal**: Restricted access for letter review only.
    - Both portals share a login endpoint with three-factor authentication and role-based redirects.
- **Letter Workflow**: Users submit requests → n8n generates letter (with jurisdiction research) → admins are notified → super admin assigns to attorney → attorney/super admin reviews, edits, approves/rejects via shared ReviewModal → on approval, n8n PDF webhook generates PDF → pdf_url saved to letter → subscriber downloads from My Letters area.
- **PDF Generation**: n8n workflow (primary, triggered on approval via `N8N_PDF_WEBHOOK_URL`), with server-side jsPDF fallback at `/api/letters/[id]/pdf`.
- **Access Control**: Granular access control functions (`requireAdminAuth`, `requireSuperAdminAuth`, `requireAttorneyAdminAccess`) manage permissions across admin functionalities.
- **Letter Assignment**: Super admins can assign letters to specific attorneys for review.

### External Dependencies
- **Supabase**: Database and Authentication services.
- **Stripe**: Payment processing, integrated via Replit Connector (`stripe-replit-sync`).
- **n8n**: Workflow automation for AI letter generation (jurisdiction research + GPT-4o) and PDF generation.
- **OpenAI**: AI model (GPT-4o) used within n8n workflow for letter generation.
- **Resend**: Email delivery service.
- **Upstash Redis**: Rate limiting.
- **Replit AI Integrations**: Provides managed OpenAI API keys and base URLs.