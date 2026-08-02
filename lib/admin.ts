import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * Admin access.
 *
 * Bootstrap: any phone listed in ADMIN_PHONES (comma-separated, E.164 or local
 * 09… form) is promoted to ADMIN on first visit. That avoids a chicken-and-egg
 * problem without exposing a "make me admin" endpoint.
 */

function adminPhones(): string[] {
  return (process.env.ADMIN_PHONES ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith("0") ? `+251${p.slice(1)}` : p));
}

export async function getAdmin() {
  const user = await getCurrentUser();
  if (!user) return null;

  if (user.role === "ADMIN") return user;

  if (user.phone && adminPhones().includes(user.phone)) {
    return db.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });
  }
  return null;
}

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/");
  return admin;
}

/** Every consequential admin action is logged — accountability, and a paper trail. */
export async function logAction(params: {
  actorId?: string | null;
  actorLabel: string;
  action: string;
  targetType: string;
  targetId: string;
  note?: string | null;
}) {
  await db.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      actorLabel: params.actorLabel,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      note: params.note ?? null,
    },
  });
}
