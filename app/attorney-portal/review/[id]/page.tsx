import { createClient } from "@/lib/supabase/server";
import { isAdminAuthenticated, getAdminSession } from "@/lib/auth/admin-session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  User,
  Mail,
  Building,
  FileText,
  Clock,
  LogOut,
} from "lucide-react";
import { format } from "date-fns";
import { LetterReviewEditor } from "@/components/letter-review-editor";

export const dynamic = 'force-dynamic';

async function getCSRFToken(): Promise<string> {
  try {
    const { generateAdminCSRF } = await import("@/lib/security/csrf");
    const csrfData = generateAdminCSRF();
    return csrfData.signedToken;
  } catch {
    return "";
  }
}

export default async function AttorneyReviewLetterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Verify admin authentication
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    redirect("/attorney-portal/login");
  }

  const { id } = await params;
  const supabase = await createClient();

  // Fetch letter with subscriber details
  const { data: letter, error } = await supabase
    .from("letters")
    .select(
      `
      *,
      profiles (
        id,
        full_name,
        email,
        phone,
        company_name
      )
    `,
    )
    .eq("id", id)
    .single();

  if (error || !letter) {
    console.error("[AttorneyReviewDetail] Error fetching letter:", error);
    notFound();
  }

  // Automatically transition to under_review if letter is pending_review
  if (letter.status === 'pending_review') {
    const adminSession = await getAdminSession();
    await supabase
      .from('letters')
      .update({
        status: 'under_review',
        reviewed_by: adminSession?.userId,
        assigned_to: adminSession?.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Log the status change
    await (supabase as any).rpc('log_letter_audit', {
      p_letter_id: id,
      p_action: 'review_started',
      p_old_status: 'pending_review',
      p_new_status: 'under_review',
      p_notes: 'Attorney opened letter for review',
    });

    // Update the letter object to reflect the new status
    letter.status = 'under_review';
    letter.reviewed_by = adminSession?.userId;
    letter.assigned_to = adminSession?.userId;
  }

  // Fetch audit trail
  const { data: auditTrail } = await supabase
    .from("letter_audit_trail")
    .select(
      `
      *,
      profiles!performed_by (
        full_name,
        email
      )
    `,
    )
    .eq("letter_id", id)
    .order("created_at", { ascending: false });

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    generating: "bg-blue-100 text-blue-800",
    pending_review: "bg-yellow-100 text-yellow-800",
    under_review: "bg-blue-100 text-blue-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };

  // Parse intake data if it exists
  const intakeData = (letter.intake_data as Record<string, any>) || {};

  // Get CSRF token for the editor actions
  const csrfToken = await getCSRFToken();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/attorney-portal/review">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Review Queue
            </Button>
          </Link>
        </div>
        <Link href="/api/admin-auth/logout">
          <Button variant="outline" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {letter.title || "Untitled Letter"}
          </h1>
          <div className="flex items-center gap-3">
            <Badge className={statusColors[letter.status]}>
              {letter.status.replace("_", " ").toUpperCase()}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Created{" "}
              {format(new Date(letter.created_at), "MMM d, yyyy h:mm a")}
            </span>
          </div>
        </div>
      </div>

      {/* Subscriber Information - Masked for Attorneys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Client Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Client ID
                </p>
                <p className="text-base font-mono text-slate-600">
                  {letter.user_id?.slice(0, 8)}...
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Email
                </p>
                <p className="text-base text-slate-600">
                  {letter.profiles?.email
                    ? letter.profiles.email.replace(
                        /(.{2})(.*)(@.*)/,
                        "$1***$3",
                      )
                    : "N/A"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 md:col-span-2">
              <Building className="w-4 h-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Letter Type
                </p>
                <p className="text-base capitalize">
                  {letter.letter_type?.replace("_", " ")}
                </p>
              </div>
            </div>

            <div className="md:col-span-2">
              <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded border border-amber-200">
                <strong>Note:</strong> Subscriber contact details are masked.
                Super Admins can view full subscriber information.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Letter Details / Case Information */}
      {Object.keys(intakeData).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Case Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
              {Object.entries(intakeData).map(([key, value]) => {
                if (!value) return null;
                return (
                  <div key={key}>
                    <p className="text-sm font-medium text-muted-foreground capitalize mb-1">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {typeof value === "object"
                        ? JSON.stringify(value, null, 2)
                        : String(value)}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inline Letter Review Editor with Rich Text Editing */}
      <LetterReviewEditor
        letter={letter}
        variant="attorney"
        csrfToken={csrfToken}
      />

      {/* Rejection Reason (if previously rejected) */}
      {letter.rejection_reason && letter.status === "rejected" && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Rejection Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">
              {letter.rejection_reason}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Audit Trail */}
      {auditTrail && auditTrail.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {auditTrail.map((entry: any) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 pb-3 border-b last:border-b-0"
                >
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {entry.action.replace("_", " ").toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(
                          new Date(entry.created_at),
                          "MMM d, yyyy h:mm a",
                        )}
                      </p>
                    </div>
                    {entry.notes && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {entry.notes}
                      </p>
                    )}
                    {entry.profiles && (
                      <p className="text-xs text-muted-foreground mt-1">
                        By: {entry.profiles.full_name || entry.profiles.email}
                      </p>
                    )}
                    {entry.old_status && entry.new_status && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Status: {entry.old_status} → {entry.new_status}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
