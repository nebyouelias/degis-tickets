import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getMyOrganizer } from "@/lib/organizer";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Organizer image upload.
 *
 * Organizers have posters in their camera roll, not on a public URL — pasting a
 * link was blocking real onboarding. Restricted to organizers, capped at 5 MB,
 * and limited to image types.
 */
export async function POST(request: Request) {
  const { user, organizer } = await getMyOrganizer();
  if (!user || !organizer) {
    return NextResponse.json({ error: "Organizer only." }, { status: 403 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Image storage is not configured yet." },
      { status: 503 }
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Use a JPG, PNG or WebP image." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image is larger than 5 MB. Compress it and try again." },
      { status: 400 }
    );
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const key = `events/${organizer.id}/${crypto.randomUUID()}.${ext}`;

  try {
    const blob = await put(key, file, {
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
