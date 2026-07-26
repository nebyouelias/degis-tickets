/**
 * Chapa API client (test & live use the same endpoints; the key decides).
 * Docs: developer.chapa.co
 */

const CHAPA_BASE = "https://api.chapa.co/v1";

function secretKey(): string {
  const key = process.env.CHAPA_SECRET_KEY;
  if (!key) throw new Error("CHAPA_SECRET_KEY is not set");
  return key;
}

export async function chapaInitialize(params: {
  amountEtb: number;
  txRef: string;
  returnUrl: string;
  phone?: string;
  email?: string;
  firstName?: string;
  title: string;
}): Promise<{ checkoutUrl: string }> {
  const res = await fetch(`${CHAPA_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: String(params.amountEtb),
      currency: "ETB",
      tx_ref: params.txRef,
      return_url: params.returnUrl,
      email: params.email ?? "degis.tickets.guest@gmail.com",
      first_name: params.firstName ?? "Degis",
      last_name: "Customer",
      phone_number: params.phone?.replace("+251", "0"),
      "customization[title]": "Degis Tickets",
      "customization[description]": params.title.slice(0, 50),
    }),
  });

  const data = (await res.json()) as {
    status?: string;
    data?: { checkout_url?: string };
    message?: unknown;
  };

  if (!res.ok || data.status !== "success" || !data.data?.checkout_url) {
    console.error("Chapa initialize failed:", JSON.stringify(data.message));
    throw new Error("Payment could not be started.");
  }
  return { checkoutUrl: data.data.checkout_url };
}

export async function chapaVerify(
  txRef: string
): Promise<{ paid: boolean; amountEtb: number }> {
  const res = await fetch(`${CHAPA_BASE}/transaction/verify/${txRef}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
    cache: "no-store",
  });
  const data = (await res.json()) as {
    status?: string;
    data?: { status?: string; amount?: number | string };
  };

  const paid = data.status === "success" && data.data?.status === "success";
  return { paid, amountEtb: Number(data.data?.amount ?? 0) };
}
