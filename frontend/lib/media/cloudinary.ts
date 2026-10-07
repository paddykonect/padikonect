/**
 * Rewrites a Cloudinary delivery URL to auto-pick a browser-friendly format
 * (f_auto converts HEIC/HEIF phone photos to JPEG/WebP) and compress/resize it
 * (q_auto + an optional width cap). Without this, iPhone HEIC uploads and
 * multi-MB originals render as a blank screen or load too slowly to see.
 * Non-Cloudinary URLs (or ones already transformed) are returned unchanged.
 */
export function cloudinaryDisplayUrl(url: string | null | undefined, opts: { width?: number } = {}): string {
  if (!url || !url.includes("/image/upload/") || url.includes("/image/upload/f_auto")) return url ?? "";
  const parts = ["f_auto", "q_auto", ...(opts.width ? [`w_${opts.width}`, "c_limit"] : [])];
  return url.replace("/image/upload/", `/image/upload/${parts.join(",")}/`);
}

export interface SignedUploadParams {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  publicId?: string;
  overwrite?: boolean;
  signature: string;
}

export interface UploadedImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

/** Uploads straight to Cloudinary with a backend-signed payload; returns the stored image's details. */
export async function uploadImageDetailed(file: File, params: SignedUploadParams): Promise<UploadedImage> {
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", params.apiKey);
  form.append("timestamp", String(params.timestamp));
  form.append("folder", params.folder);
  form.append("signature", params.signature);
  if (params.publicId) form.append("public_id", params.publicId);
  if (params.overwrite !== undefined) form.append("overwrite", String(params.overwrite));

  const res = await fetch(`https://api.cloudinary.com/v1_1/${params.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Photo upload failed. Please try again.");
  const json = (await res.json()) as { secure_url: string; public_id: string; width: number; height: number };
  return { url: json.secure_url, publicId: json.public_id, width: json.width, height: json.height };
}

/** Same as uploadImageDetailed, when only the HTTPS URL is needed. */
export async function uploadImage(file: File, params: SignedUploadParams): Promise<string> {
  return (await uploadImageDetailed(file, params)).url;
}
