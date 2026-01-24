"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export type LetterStatus =
  | "draft"
  | "generating"
  | "pending_review"
  | "under_review"
  | "approved"
  | "rejected"
  | "failed"
  | "completed";

interface GenerationTrackerModalProps {
  isOpen: boolean;
  letterId?: string;
  initialStatus?: LetterStatus;
  showClose?: boolean;
  onClose?: () => void;
}

const FINAL_STATUSES: LetterStatus[] = [
  "approved",
  "rejected",
  "failed",
  "completed",
];

export function GenerationTrackerModal({
  isOpen,
  letterId,
  initialStatus = "generating",
  showClose = true,
  onClose,
}: GenerationTrackerModalProps) {
  const [open, setOpen] = useState(isOpen);
  const [status, setStatus] = useState<LetterStatus>(initialStatus);

  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus);
    }
  }, [initialStatus]);

  const isFinal = FINAL_STATUSES.includes(status);

  useEffect(() => {
    if (!open || !letterId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`letter-status:${letterId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "letters",
          filter: `id=eq.${letterId}`,
        },
        (payload: RealtimePostgresChangesPayload<{ status: string }>) => {
          const nextStatus =
            "status" in payload.new &&
            (payload.new.status as LetterStatus | undefined);
          if (nextStatus) {
            setStatus(nextStatus);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, letterId]);

  useEffect(() => {
    if (!open || !letterId || isFinal) return;

    const supabase = createClient();
    let isMounted = true;

    const pollStatus = async () => {
      const { data } = await supabase
        .from("letters")
        .select("status")
        .eq("id", letterId)
        .single();

      if (!isMounted) return;
      if (data?.status) {
        setStatus(data.status as LetterStatus);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 12000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [open, letterId, isFinal]);

  const { steps, currentStep, statusTitle, statusDescription } = useMemo(() => {
    const draftStepDescription =
      status === "draft"
        ? "Draft saved. Submit when you are ready for attorney review."
        : status === "generating"
          ? "Preparing your draft based on the details you provided."
          : "Draft created and queued for attorney review.";

    const reviewStepDescription =
      status === "pending_review"
        ? "Waiting for an attorney to begin review."
        : status === "under_review"
          ? "An attorney is reviewing and may edit your letter."
          : "Attorney approval is complete.";

    const finalStepTitle =
      status === "rejected"
        ? "Needs revision"
        : status === "failed"
          ? "Draft failed"
          : "Approved";

    const finalStepDescription =
      status === "rejected"
        ? "Our team left notes. Please review and resubmit."
        : status === "failed"
          ? "We could not prepare your draft. Please try again."
          : "Your letter is approved and ready to view.";

    const timelineSteps = [
      { title: "Draft prepared", description: draftStepDescription },
      { title: "Attorney approval", description: reviewStepDescription },
      { title: finalStepTitle, description: finalStepDescription },
    ];

    const stepIndex =
      status === "draft" || status === "generating"
        ? 0
        : status === "pending_review" || status === "under_review"
          ? 1
          : 2;

    const headerTitle =
      status === "draft"
        ? "Draft saved"
        : status === "generating"
          ? "Preparing your draft"
          : status === "pending_review"
            ? "Draft created"
            : status === "under_review"
              ? "Attorney approval in progress"
              : status === "rejected"
                ? "Needs revision"
                : status === "failed"
                  ? "Draft failed"
                  : "Approved";

    const headerDescription =
      status === "draft"
        ? "Save your details and submit when you are ready for review."
        : status === "generating"
          ? "We are preparing your draft and routing it to attorney review."
          : status === "pending_review"
            ? "Your draft is queued for attorney review."
            : status === "under_review"
              ? "An attorney is reviewing and may edit your letter."
              : status === "rejected"
                ? "We sent feedback so you can update and resubmit."
                : status === "failed"
                  ? "Please try again or contact support."
                  : "Your letter is approved and ready in your dashboard.";

    return {
      steps: timelineSteps,
      currentStep: FINAL_STATUSES.includes(status)
        ? timelineSteps.length
        : stepIndex,
      statusTitle: headerTitle,
      statusDescription: headerDescription,
    };
  }, [status]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-lg animate-in fade-in zoom-in duration-300">
        <div className="mb-6 text-center" role="status" aria-live="polite">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Letter timeline
          </p>
          <h2 className="text-xl font-semibold text-foreground">
            {statusTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{statusDescription}</p>
        </div>

        <div className="relative ml-4 space-y-8 before:absolute before:left-2.75 before:top-2 before:h-[calc(100%-16px)] before:w-0.5 before:bg-muted">
          <div
            className="absolute left-2.75 top-2 w-0.5 bg-primary transition-all duration-1000 ease-linear motion-reduce:transition-none"
            style={{
              height: `calc(${Math.min(currentStep, steps.length - 1) / (steps.length - 1)} * (100% - 16px))`,
            }}
          />

          {steps.map((step, index) => {
            const isCompleted = currentStep > index;
            const isCurrent = currentStep === index;
            const isFinalStep = index === steps.length - 1;
            const showRejected = isFinalStep && status === "rejected";
            const showFailed = isFinalStep && status === "failed";
            const showSuccess =
              isFinalStep && (status === "approved" || status === "completed");
            const successIconClass = cn(
              "h-4 w-4",
              showSuccess &&
                "animate-in zoom-in duration-200 motion-reduce:animate-none",
            );

            return (
              <div key={step.title} className="relative flex items-start gap-4">
                <div
                  className={cn(
                    "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background transition-colors duration-300",
                    isCompleted || isCurrent
                      ? "border-primary text-primary"
                      : "border-muted text-muted-foreground",
                    isCurrent && "ring-4 ring-primary/20",
                  )}
                >
                  {showRejected || showFailed ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : isCompleted ? (
                    <CheckCircle2 className={successIconClass} />
                  ) : isCurrent ? (
                    <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
                <div className="flex-1 pt-0.5">
                  <h3
                    className={cn(
                      "font-medium leading-none transition-colors",
                      isCompleted || isCurrent
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
          Typical review time: under 24 hours. You will receive a notification
          when approval is complete.
        </div>

        {showClose && (
          <div className="mt-6 flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                onClose?.();
              }}
            >
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
