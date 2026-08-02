"use client";

import { FileUpload } from "@/components/organizer/FileUpload";

export function ImageUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  return (
    <FileUpload
      value={value}
      onChange={onChange}
      kind="poster"
      title="Upload event poster"
      hint="JPG, PNG or WebP · up to 8 MB"
    />
  );
}
