"use client";

import * as React from "react";
import { useCallback, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  preview?: string;
  status: "uploading" | "success" | "error";
  progress?: number;
  error?: string;
}

interface FileUploadProps {
  onFilesChange: (files: UploadedFile[]) => void;
  files: UploadedFile[];
  maxFiles?: number;
  maxSizeBytes?: number;
  acceptedTypes?: string[];
  disabled?: boolean;
  className?: string;
}

const DEFAULT_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileIcon(type: string): React.ReactNode {
  if (type.startsWith("image/")) {
    return (
      <svg
        className="w-8 h-8 text-blue-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    );
  }
  if (type === "application/pdf") {
    return (
      <svg
        className="w-8 h-8 text-red-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
    );
  }
  if (type.includes("word") || type.includes("document")) {
    return (
      <svg
        className="w-8 h-8 text-blue-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    );
  }
  if (
    type.includes("excel") ||
    type.includes("spreadsheet") ||
    type === "text/csv"
  ) {
    return (
      <svg
        className="w-8 h-8 text-green-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    );
  }
  return (
    <svg
      className="w-8 h-8 text-gray-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  );
}

export function FileUpload({
  onFilesChange,
  files,
  maxFiles = 5,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  disabled = false,
  className,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): { valid: boolean; error?: string } => {
      if (!acceptedTypes.includes(file.type)) {
        return {
          valid: false,
          error: `File type "${file.type}" is not supported`,
        };
      }
      if (file.size > maxSizeBytes) {
        return {
          valid: false,
          error: `File size exceeds ${formatFileSize(maxSizeBytes)}`,
        };
      }
      return { valid: true };
    },
    [acceptedTypes, maxSizeBytes],
  );

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const newFiles: UploadedFile[] = [];
      const filesToProcess = Array.from(fileList);

      // Check if adding these files would exceed the limit
      const remainingSlots = maxFiles - files.length;
      if (remainingSlots <= 0) {
        return;
      }

      const filesToAdd = filesToProcess.slice(0, remainingSlots);

      for (const file of filesToAdd) {
        const validation = validateFile(file);
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create preview for images
        let preview: string | undefined;
        if (file.type.startsWith("image/")) {
          preview = URL.createObjectURL(file);
        }

        const uploadedFile: UploadedFile = {
          id,
          name: file.name,
          size: file.size,
          type: file.type,
          preview,
          status: validation.valid ? "uploading" : "error",
          error: validation.error,
          progress: 0,
        };

        newFiles.push(uploadedFile);
      }

      // Add new files to the list
      const updatedFiles = [...files, ...newFiles];
      onFilesChange(updatedFiles);

      // Simulate upload for valid files (in real implementation, upload to Supabase Storage)
      for (const uploadedFile of newFiles) {
        if (uploadedFile.status === "uploading") {
          // Simulate upload progress
          const fileIndex = updatedFiles.findIndex(
            (f) => f.id === uploadedFile.id,
          );
          if (fileIndex !== -1) {
            // Simulate progress updates
            for (let progress = 0; progress <= 100; progress += 20) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              updatedFiles[fileIndex] = {
                ...updatedFiles[fileIndex],
                progress,
              };
              onFilesChange([...updatedFiles]);
            }
            // Mark as success
            updatedFiles[fileIndex] = {
              ...updatedFiles[fileIndex],
              status: "success",
              progress: 100,
            };
            onFilesChange([...updatedFiles]);
          }
        }
      }
    },
    [files, maxFiles, validateFile, onFilesChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const { files: droppedFiles } = e.dataTransfer;
      if (droppedFiles?.length) {
        processFiles(droppedFiles);
      }
    },
    [disabled, processFiles],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { files: selectedFiles } = e.target;
      if (selectedFiles?.length) {
        processFiles(selectedFiles);
      }
      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [processFiles],
  );

  const handleRemoveFile = useCallback(
    (id: string) => {
      const fileToRemove = files.find((f) => f.id === id);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      onFilesChange(files.filter((f) => f.id !== id));
    },
    [files, onFilesChange],
  );

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleBrowseClick}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 cursor-pointer",
          "hover:border-primary hover:bg-primary/5",
          isDragOver && "border-primary bg-primary/10 scale-[1.02]",
          disabled &&
            "opacity-50 cursor-not-allowed hover:border-border hover:bg-transparent",
          !disabled && !isDragOver && "border-muted-foreground/25 bg-muted/30",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(",")}
          onChange={handleFileInput}
          disabled={disabled}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center text-center">
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors",
              isDragOver ? "bg-primary/20" : "bg-muted",
            )}
          >
            <svg
              className={cn(
                "w-6 h-6 transition-colors",
                isDragOver ? "text-primary" : "text-muted-foreground",
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <p className="text-sm font-medium text-foreground mb-1">
            {isDragOver ? "Drop files here" : "Drag & drop files here"}
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            or <span className="text-primary font-medium">browse</span> to
            select
          </p>
          <p className="text-xs text-muted-foreground">
            PDF, Word, Excel, Images • Max {formatFileSize(maxSizeBytes)} per
            file • Up to {maxFiles} files
          </p>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Uploaded Files ({files.length}/{maxFiles})
          </p>
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border bg-card",
                  file.status === "error" &&
                    "border-destructive/50 bg-destructive/5",
                )}
              >
                {/* File icon or preview */}
                <div className="shrink-0">
                  {file.preview ? (
                    <Image
                      src={file.preview}
                      alt={file.name}
                      width={40}
                      height={40}
                      className="rounded object-cover"
                      unoptimized
                    />
                  ) : (
                    getFileIcon(file.type)
                  )}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                    {file.error && (
                      <span className="text-destructive ml-2">
                        • {file.error}
                      </span>
                    )}
                  </p>

                  {/* Progress bar */}
                  {file.status === "uploading" && (
                    <div className="mt-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-200"
                        style={{ width: `${file.progress || 0}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Status icon */}
                <div className="shrink-0">
                  {file.status === "uploading" && (
                    <svg
                      className="w-5 h-5 text-muted-foreground animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  )}
                  {file.status === "success" && (
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                  {file.status === "error" && (
                    <svg
                      className="w-5 h-5 text-destructive"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(file.id);
                  }}
                  className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
                  disabled={disabled}
                >
                  <svg
                    className="w-4 h-4 text-muted-foreground hover:text-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
