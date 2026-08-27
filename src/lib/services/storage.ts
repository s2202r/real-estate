import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * File storage.
 *
 * Two rules:
 *   1. Uploads are validated SERVER-SIDE against a MIME allow-list and a size
 *      cap. A browser-side `accept` attribute is a hint, not a control.
 *   2. Private objects are never linked directly. They are served through
 *      short-lived signed URLs minted after an authorisation check, so a URL
 *      that leaks into a screenshot or a log expires by itself.
 *
 * Every private object is stored under `<user_id>/...`, which makes ownership
 * verifiable from the path alone and lets storage RLS enforce it.
 */

export const BUCKETS = {
  propertyMedia: "property-media",
  propertyDocuments: "property-documents",
  agentDocuments: "agent-documents",
  userDocuments: "user-documents",
  agreements: "agreements",
  avatars: "avatars",
  marketingAssets: "marketing-assets",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

const PUBLIC_BUCKETS: readonly BucketName[] = [
  BUCKETS.propertyMedia,
  BUCKETS.avatars,
  BUCKETS.marketingAssets,
];

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
const VIDEO_TYPES = ["video/mp4", "video/webm"] as const;
const DOCUMENT_TYPES = ["application/pdf", ...IMAGE_TYPES] as const;

interface BucketPolicy {
  readonly allowedTypes: readonly string[];
  readonly maxBytes: number;
  readonly isPublic: boolean;
}

const BUCKET_POLICIES: Record<BucketName, BucketPolicy> = {
  [BUCKETS.propertyMedia]: {
    allowedTypes: [...IMAGE_TYPES, ...VIDEO_TYPES],
    maxBytes: 200 * 1024 * 1024,
    isPublic: true,
  },
  [BUCKETS.avatars]: { allowedTypes: IMAGE_TYPES, maxBytes: 5 * 1024 * 1024, isPublic: true },
  [BUCKETS.marketingAssets]: {
    allowedTypes: [...IMAGE_TYPES, "application/pdf"],
    maxBytes: 50 * 1024 * 1024,
    isPublic: true,
  },
  [BUCKETS.propertyDocuments]: {
    allowedTypes: DOCUMENT_TYPES,
    maxBytes: 25 * 1024 * 1024,
    isPublic: false,
  },
  [BUCKETS.agentDocuments]: {
    allowedTypes: DOCUMENT_TYPES,
    maxBytes: 25 * 1024 * 1024,
    isPublic: false,
  },
  [BUCKETS.userDocuments]: {
    allowedTypes: DOCUMENT_TYPES,
    maxBytes: 25 * 1024 * 1024,
    isPublic: false,
  },
  [BUCKETS.agreements]: {
    allowedTypes: ["application/pdf"],
    maxBytes: 25 * 1024 * 1024,
    isPublic: false,
  },
};

/** Extensions that must agree with the declared MIME type. */
const EXTENSION_BY_TYPE: Record<string, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
  "video/mp4": ["mp4"],
  "video/webm": ["webm"],
  "application/pdf": ["pdf"],
};

export class UploadValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export interface UploadInput {
  readonly bucket: BucketName;
  readonly userId: string;
  readonly file: File;
  /** Path segment after the owner id, e.g. "listings/<listingId>". */
  readonly folder?: string;
}

export interface UploadResult {
  readonly bucket: BucketName;
  readonly path: string;
  readonly publicUrl: string | null;
  readonly size: number;
  readonly mimeType: string;
}

/**
 * Validate a file against its bucket policy.
 *
 * Checks the declared MIME type against an allow-list, the size against a cap,
 * and that the extension agrees with the MIME type — so `payload.pdf.exe`
 * cannot masquerade as a PDF.
 */
export function validateUpload(bucket: BucketName, file: File): void {
  const policy = BUCKET_POLICIES[bucket];

  if (!policy.allowedTypes.includes(file.type)) {
    throw new UploadValidationError(
      `${file.type || "This file type"} is not allowed in ${bucket}. Allowed: ${policy.allowedTypes.join(", ")}.`,
    );
  }

  if (file.size <= 0) {
    throw new UploadValidationError("The file is empty.");
  }

  if (file.size > policy.maxBytes) {
    throw new UploadValidationError(
      `File is ${formatBytes(file.size)}; the limit for ${bucket} is ${formatBytes(policy.maxBytes)}.`,
    );
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const expected = EXTENSION_BY_TYPE[file.type];
  if (expected && !expected.includes(extension)) {
    throw new UploadValidationError(
      `File extension ".${extension}" does not match its declared type ${file.type}.`,
    );
  }
}

export async function uploadFile(input: UploadInput): Promise<UploadResult> {
  validateUpload(input.bucket, input.file);

  const supabase = await createClient();
  // Ownership is encoded in the path so storage RLS can verify it.
  const path = buildObjectPath(input.userId, input.folder, input.file.name);

  const { error } = await supabase.storage.from(input.bucket).upload(path, input.file, {
    contentType: input.file.type,
    upsert: false,
    cacheControl: PUBLIC_BUCKETS.includes(input.bucket) ? "31536000" : "0",
  });

  if (error) {
    throw new UploadValidationError(`Upload failed: ${error.message}`);
  }

  return {
    bucket: input.bucket,
    path,
    publicUrl: PUBLIC_BUCKETS.includes(input.bucket) ? publicUrlFor(input.bucket, path) : null,
    size: input.file.size,
    mimeType: input.file.type,
  };
}

function buildObjectPath(userId: string, folder: string | undefined, fileName: string): string {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-80);
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const segments = [userId, folder, `${unique}-${safeName}`].filter(Boolean);
  return segments.join("/");
}

export function publicUrlFor(bucket: BucketName, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Mint a short-lived signed URL for a private object.
 *
 * The CALLER is responsible for having verified that this user may see this
 * object; this function only mints the link. It deliberately uses the
 * service-role client, because the whole point is to hand a URL to someone who
 * does not have direct storage access.
 */
export async function createSignedUrl(
  bucket: BucketName,
  path: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  if (PUBLIC_BUCKETS.includes(bucket)) return publicUrlFor(bucket, path);

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) return null;
  return data.signedUrl;
}

export async function deleteObject(bucket: BucketName, path: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return !error;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
