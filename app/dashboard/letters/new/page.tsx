"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubscriptionModal } from "@/components/subscription-modal";
import { GenerateButton } from "@/components/generate-button";
import {
  GenerationTrackerModal,
  type LetterStatus,
} from "@/components/generation-tracker-modal";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { FormStepper } from "@/components/ui/form-stepper";
import { LetterTypeSelector, LETTER_TYPES } from "@/components/letter-type-selector";
import { createClient } from "@/lib/supabase/client";
import { US_STATES } from "@/lib/validation/letter-schema";
import { toast } from "sonner";

export const dynamic = 'force-dynamic';

const FORM_STEPS = [
  { label: 'Select Type', description: 'Choose your letter type' },
  { label: 'Fill Details', description: 'Provide case information' },
  { label: 'Review & Submit', description: 'Review and send for approval' },
];



export default function NewLetterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState("");
  const [letterId, setLetterId] = useState<string | null>(null);
  const [isFreeTrial, setIsFreeTrial] = useState(false);
  const [showPricingOverlay, setShowPricingOverlay] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [trackerStatus, setTrackerStatus] =
    useState<LetterStatus>("generating");
  const [formData, setFormData] = useState({
    senderName: "",
    senderAddress: "",
    senderState: "",
    recipientName: "",
    recipientAddress: "",
    recipientState: "",
    issueDescription: "",
    desiredOutcome: "",
    amountDemanded: "",
    deadlineDate: "",
    incidentDate: "",
    supportingDocuments: "",
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    setIsChecking(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsChecking(false);
        return;
      }

      // Check if user has generated any letters before (Free Trial Check)
      const { count } = await supabase
        .from("letters")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const isFreeTrial = (count || 0) === 0;

      // If free trial, user can generate without subscription
      if (isFreeTrial) {
        setHasSubscription(true);
        setIsChecking(false);
        return;
      }

      // Check for active subscription with credits
      const { data: subscriptions, error } = await supabase
        .from("subscriptions")
        .select("credits_remaining, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error fetching subscription:", error);
        setHasSubscription(false);
        return;
      }

      const subscription = subscriptions?.[0];
      setHasSubscription(
        !!(subscription && subscription.credits_remaining > 0),
      );
    } catch (error) {
      console.error("Error checking subscription:", error);
      setHasSubscription(false);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ALWAYS start generation (free trial or subscription)
    setLoading(true);
    setError(null);
    setShowTrackerModal(true);
    setTrackerStatus("generating");

    // Show paywall modal immediately for free trial users
    if (!hasSubscription) {
      // Delay paywall slightly so timeline appears first
      setTimeout(() => {
        setShowSubscriptionModal(true);
      }, 500);
    }

    try {
      // Prepare uploaded files data for the API
      const attachedFiles = uploadedFiles
        .filter((f) => f.status === "success")
        .map((f) => ({
          name: f.name,
          type: f.type,
          size: f.size,
          url: f.url || undefined,
        }));

      const intakeData = {
        senderName: formData.senderName,
        senderAddress: formData.senderAddress,
        senderState: formData.senderState,
        recipientName: formData.recipientName,
        recipientAddress: formData.recipientAddress,
        recipientState: formData.recipientState,
        issueDescription: formData.issueDescription,
        desiredOutcome: formData.desiredOutcome,
        amountDemanded: formData.amountDemanded
          ? Number(formData.amountDemanded)
          : undefined,
        deadlineDate: formData.deadlineDate || undefined,
        incidentDate: formData.incidentDate || undefined,
        additionalDetails: formData.supportingDocuments || undefined,
        attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined,
      };

      const requestBody = {
        letterType: selectedType,
        intakeData,
      };

      const response = await fetch("/api/generate-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (
          errorData.needsSubscription ||
          errorData.details?.needsSubscription
        ) {
          setShowTrackerModal(false);
          router.push("/dashboard/subscription");
          return;
        }
        // Show detailed validation errors if available
        let errorMessage = errorData.error || "Failed to generate letter";
        if (errorData.details) {
          // Handle both array and string details
          if (Array.isArray(errorData.details)) {
            errorMessage = `${errorData.error}: ${errorData.details.join(", ")}`;
          } else if (typeof errorData.details === "string") {
            errorMessage = `${errorData.error}: ${errorData.details}`;
          } else if (typeof errorData.details === "object") {
            // Handle Zod validation errors which have an array of issues
            const issues = errorData.details as Array<{
              message?: string;
              path?: string[];
            }>;
            if (issues.length > 0 && issues[0].message) {
              errorMessage = `${errorData.error}: ${issues.map((i) => i.message).join(", ")}`;
            }
          }
        }
        throw new Error(errorMessage);
      }

      const {
        letterId: newLetterId,
        aiDraft: draft,
        isFreeTrial: freeTrialFlag,
        status,
      } = await response.json();
      setLetterId(newLetterId);
      setAiDraft(draft || "");
      setIsFreeTrial(!!freeTrialFlag);
      setShowPricingOverlay(!!freeTrialFlag);
      if (status) {
        setTrackerStatus(status as LetterStatus);
      }

      toast.success('Letter submitted for review!');
      router.push(`/dashboard/letters/${newLetterId}?submitted=1`);
    } catch (err: any) {
      console.error("[v0] Letter creation error:", err);
      const errorMessage = err.message || "Failed to create letter";
      setError(errorMessage);
      toast.error(errorMessage);
      setShowTrackerModal(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <GenerationTrackerModal
        isOpen={showTrackerModal}
        initialStatus={trackerStatus}
        showClose={false}
      />
      <SubscriptionModal
        show={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        message="Your free letter is being generated! Subscribe now to generate unlimited attorney-approved letters:"
      />
      <h1 className="text-3xl font-bold text-foreground mb-4">
        Create New Letter
      </h1>
      <FormStepper
        steps={FORM_STEPS}
        currentStep={aiDraft ? 2 : selectedType ? 1 : 0}
      />
      <div className="mb-4" />
      {!selectedType ? (
        <div className="bg-card rounded-lg shadow-sm border p-8">
          <LetterTypeSelector
            onSelect={setSelectedType}
            selectedType={selectedType}
          />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-card rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">
                {LETTER_TYPES.find((t) => t.value === selectedType)?.label}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedType("")}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Change type
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="senderName">Your Full Name</Label>
                  <Input
                    id="senderName"
                    value={formData.senderName}
                    onChange={(e) =>
                      setFormData({ ...formData, senderName: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="recipientName">Recipient Name</Label>
                  <Input
                    id="recipientName"
                    value={formData.recipientName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        recipientName: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="senderAddress">Your Address</Label>
                <Textarea
                  id="senderAddress"
                  rows={3}
                  value={formData.senderAddress}
                  onChange={(e) =>
                    setFormData({ ...formData, senderAddress: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="senderState">Your State</Label>
                <select
                  id="senderState"
                  value={formData.senderState}
                  onChange={(e) =>
                    setFormData({ ...formData, senderState: e.target.value })
                  }
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select your state</option>
                  {US_STATES.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.name} ({state.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="recipientAddress">Recipient Address</Label>
                <Textarea
                  id="recipientAddress"
                  rows={3}
                  value={formData.recipientAddress}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recipientAddress: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="recipientState">Recipient State</Label>
                <select
                  id="recipientState"
                  value={formData.recipientState}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recipientState: e.target.value,
                    })
                  }
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select recipient state</option>
                  {US_STATES.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.name} ({state.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="issueDescription">Issue Description</Label>
                <Textarea
                  id="issueDescription"
                  rows={6}
                  placeholder="Describe the issue in detail. Include relevant dates, events, and any supporting information..."
                  value={formData.issueDescription}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      issueDescription: e.target.value,
                    })
                  }
                  required
                />
              </div>

              {selectedType === "demand_letter" && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amountDemanded">Amount Demanded ($)</Label>
                    <Input
                      id="amountDemanded"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.amountDemanded}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          amountDemanded: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="deadlineDate">Deadline for Response</Label>
                    <Input
                      id="deadlineDate"
                      type="date"
                      value={formData.deadlineDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          deadlineDate: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {selectedType === "cease_desist" && (
                <div>
                  <Label htmlFor="deadlineDate">
                    Deadline to Cease Activity
                  </Label>
                  <Input
                    id="deadlineDate"
                    type="date"
                    value={formData.deadlineDate}
                    onChange={(e) =>
                      setFormData({ ...formData, deadlineDate: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Specify by when the activity must stop
                  </p>
                </div>
              )}

              {(selectedType === "contract_breach" ||
                selectedType === "employment_dispute") && (
                <div>
                  <Label htmlFor="incidentDate">Date of Incident/Breach</Label>
                  <Input
                    id="incidentDate"
                    type="date"
                    value={formData.incidentDate}
                    onChange={(e) =>
                      setFormData({ ...formData, incidentDate: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    When did the breach or incident occur?
                  </p>
                </div>
              )}

              {selectedType === "eviction_notice" && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="deadlineDate">Notice to Vacate By</Label>
                    <Input
                      id="deadlineDate"
                      type="date"
                      value={formData.deadlineDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          deadlineDate: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="incidentDate">Lease Start Date</Label>
                    <Input
                      id="incidentDate"
                      type="date"
                      value={formData.incidentDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          incidentDate: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {selectedType === "consumer_complaint" && (
                <div>
                  <Label htmlFor="incidentDate">
                    Date of Purchase or Incident
                  </Label>
                  <Input
                    id="incidentDate"
                    type="date"
                    value={formData.incidentDate}
                    onChange={(e) =>
                      setFormData({ ...formData, incidentDate: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    When did you purchase the product or when did the issue
                    occur?
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="desiredOutcome">Desired Outcome</Label>
                <Textarea
                  id="desiredOutcome"
                  rows={3}
                  placeholder="What resolution are you seeking?"
                  value={formData.desiredOutcome}
                  onChange={(e) =>
                    setFormData({ ...formData, desiredOutcome: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                  Supporting Documents (Optional)
                </Label>
                <FileUpload
                  files={uploadedFiles}
                  onFilesChange={setUploadedFiles}
                  maxFiles={5}
                  maxSizeBytes={10 * 1024 * 1024}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Upload contracts, invoices, emails, photos, or any documents
                  that support your case. The AI will review these to create a
                  more accurate draft.
                </p>

                {/* Optional text field for additional document descriptions */}
                <div className="mt-3">
                  <Label
                    htmlFor="supportingDocuments"
                    className="text-xs text-muted-foreground"
                  >
                    Additional notes about your documents (optional)
                  </Label>
                  <Textarea
                    id="supportingDocuments"
                    rows={2}
                    placeholder="Describe any additional context about your documents..."
                    value={formData.supportingDocuments}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        supportingDocuments: e.target.value,
                      })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-6">
              <GenerateButton
                type="submit"
                loading={loading}
                disabled={loading || isChecking}
                hasSubscription={hasSubscription}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/letters")}
              >
                Cancel
              </Button>
            </div>
            {!hasSubscription && !isChecking && (
              <p className="mt-2 text-sm text-muted-foreground text-center">
                A subscription is required to generate and submit attorney
                drafts
              </p>
            )}
          </div>
        </form>
      )}

      {aiDraft && (
        <div className="mt-10 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-tight">
                Draft Ready
              </p>
              <h2 className="text-2xl font-semibold text-foreground">
                Attorney-generated draft
              </h2>
              <p className="text-sm text-muted-foreground">
                Review the draft below. You can submit for attorney approval after
                subscribing.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {letterId && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/letters/${letterId}`)}
                >
                  Open Letter Page
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/subscription")}
              >
                Manage Subscription
              </Button>
            </div>
          </div>

          <div className="relative">
            <div
              className={`bg-card border rounded-lg p-4 whitespace-pre-wrap leading-relaxed ${showPricingOverlay ? "blur-sm pointer-events-none select-none" : ""}`}
            >
              {aiDraft}
            </div>

            {showPricingOverlay && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white border shadow-xl rounded-lg p-6 max-w-xl w-full space-y-4">
                  <h3 className="text-xl font-semibold">
                    Unlock attorney approved letters
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Your first draft is free to preview. Subscribe to submit
                    this letter for attorney approval and delivery.
                  </p>
                  <div className="grid gap-3">
                    <div className="border rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold">Single Letter</div>
                        <div className="text-sm text-muted-foreground">
                          One-time review
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">$200</div>
                        <Button
                          size="sm"
                          className="mt-2"
                          onClick={() => router.push("/dashboard/subscription")}
                        >
                          Choose
                        </Button>
                      </div>
                    </div>
                    <div className="border rounded-lg p-3 flex items-center justify-between bg-primary/5">
                      <div>
                        <div className="font-semibold">Monthly Membership</div>
                        <div className="text-sm text-muted-foreground">
                          $50 per letter
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">$200/mo</div>
                        <Button
                          size="sm"
                          className="mt-2"
                          onClick={() => router.push("/dashboard/subscription")}
                        >
                          Choose
                        </Button>
                      </div>
                    </div>
                    <div className="border rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold">Annual Plan</div>
                        <div className="text-sm text-muted-foreground">
                          48 letters included (≈$41.67/letter)
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">$2,000</div>
                        <Button
                          size="sm"
                          className="mt-2"
                          onClick={() => router.push("/dashboard/subscription")}
                        >
                          Choose
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Button
                      variant="secondary"
                      onClick={() => setShowPricingOverlay(false)}
                    >
                      Preview letter draft
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      Subscription required to submit for attorney approval
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!isFreeTrial && (
            <div className="flex items-center justify-between bg-muted/50 border rounded-lg p-4">
              <div>
                <p className="font-medium text-foreground">Ready to submit?</p>
                <p className="text-sm text-muted-foreground">
                  Send this draft to our attorneys for review and approval.
                </p>
              </div>
              {letterId && (
                <Button
                  onClick={() => router.push(`/dashboard/letters/${letterId}`)}
                >
                  Submit for Attorney Approval
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
