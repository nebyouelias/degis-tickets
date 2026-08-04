import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth";
import { getMyOrganizer } from "@/lib/organizer";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DOC_TYPES = new Set(["application/pdf"]);

/**
 * Uploads.
 *  - kind=poster   → event cover. Organizers only. Images only.
 *  - kind=document → trade licence / ID. Any signed-in user, because applicants
 *                    are not organizers yet. Images or PDF.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "File storage is not configured yet." },
      { status: 503 }
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") ?? "poster");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }

  const isDocument = kind === "document";

  if (!isDocument) {
    const { organizer } = await getMyOrganizer();
    if (!organizer) {
      return NextResponse.json({ error: "Organizer only." }, { status: 403 });
    }
  }

const allowed = isDocument
    ? new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"])
    : IMAGE_TYPES;

  if (!allowed.has(file.type)) {
    return NextResponse.json(
      {
        error: isDocument
          ? "Upload a PDF, JPG, PNG or WebP."
          : "Use a JPG, PNG or WebP image.",
      },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File is larger than 8 MB." },
      { status: 400 }
    );
  }

  const ext =
    file.type === "application/pdf"
      ? "pdf"
      : file.type.split("/")[1].replace("jpeg", "jpg");
  const folder = isDocument ? `documents/${user.id}` : `events/${user.id}`;

  try {
    const blob = await put(`${folder}/${crypto.randomUUID()}.${ext}`, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    console.error("Blob upload failed:", e);
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 });
  }
}
