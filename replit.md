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

**Technical Implementations & Feature Specifications:**
- **Authentication**: Supabase Auth manages user accounts, complemented by JWT-signed sessions for admin portals.
- **Database**: Supabase (PostgreSQL) serves as the primary data store.
- **Payments**: Stripe integration, managed via the Replit Connector, handles all payment processing.
- **AI Letter Generation**: The primary method uses an n8n workflow for generating letters, incorporating jurisdiction-specific research using GPT-4o. A direct OpenAI (gpt-4o) integration acts as a fallback.
- **Email Service**: Resend is used for sending templated emails, queued for efficient delivery.
- **Rate Limiting**: Upstash Redis is implemented for API rate limiting.
- **Admin Portals**: A dual-portal system exists:
    - **Super Admin Gateway**: Provides full system access (analytics, users, coupons, commissions, letter review).
    - **Attorney Portal**: Restricted access for letter review only.
    - Both portals share a login endpoint with three-factor authentication and role-based redirects.
- **Letter Workflow**: Users submit requests, letters are generated (n8n primary, OpenAI fallback), admins are notified, review letters (start, approve, reject), and users download approved PDFs.
- **Access Control**: Granular access control functions (`requireAdminAuth`, `requireSuperAdminAuth`, `requireAttorneyAdminAccess`) manage permissions across admin functionalities.
- **Letter Assignment**: Super admins can assign letters to specific attorneys for review.

### External Dependencies
- **Supabase**: Database and Authentication services.
- **Stripe**: Payment processing, integrated via Replit Connector (`stripe-replit-sync`).
- **n8n**: Workflow automation for primary AI letter generation and jurisdiction research.
- **OpenAI**: AI model (GPT-4o) for letter generation (fallback and within n8n).
- **Resend**: Email delivery service.
- **Upstash Redis**: Rate limiting.
- **Replit AI Integrations**: Provides managed OpenAI API keys and base URLs.