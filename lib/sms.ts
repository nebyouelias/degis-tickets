/**
 * SMS delivery.
 *
 * Providers are selected by which env vars are present, so switching from
 * testing to an Ethiopian aggregator is configuration, not a code change:
 *
 *   1. OTP_DEV_MODE=true      → nothing sent; codes shown on screen (dev only)
 *   2. AFROMESSAGE_TOKEN      → AfroMessage (Ethiopian, Ethio Telecom routes)
 *   3. SMS_WEBHOOK_URL        → generic POST adapter for any other aggregator
 *   4. TWILIO_*               → Twilio (international; good for testing)
 *
 * Cost note that matters in Ethiopia: GSM-7 (Latin) fits 160 characters per
 * segment, but any Amharic character switches the whole message to UCS-2 at 70
 * characters per segment — roughly 2.3x the cost. Templates below are therefore
 * Latin-only by default; see lib/notify.ts.
 */

export type SmsResult = {
  delivered: boolean;
  devMode: boolean;
  provider: string;
  error?: string;
};

function devModeOn(): boolean {
  return process.env.OTP_DEV_MODE?.toLowerCase().trim() === "true";
}

/** E.164 for most gateways; AfroMessage accepts both 09... and +251... */
function toE164(phone: string): string {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (/^0[79]\d{8}$/.test(cleaned)) return `+251${cleaned.slice(1)}`;
  if (/^251\d{9}$/.test(cleaned)) return `+${cleaned}`;
  return cleaned;
}

async function sendViaAfroMessage(to: string, body: string): Promise<SmsResult> {
  const token = process.env.AFROMESSAGE_TOKEN!;
  const sender = process.env.AFROMESSAGE_SENDER ?? "";
  const identifier = process.env.AFROMESSAGE_IDENTIFIER ?? "";

  const url = new URL("https://api.afromessage.com/api/send");
  url.searchParams.set("to", toE164(to));
  url.searchParams.set("message", body);
  if (sender) url.searchParams.set("sender", sender);
  if (identifier) url.searchParams.set("from", identifier);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json().catch(() => ({}))) as { acknowledge?: string };
  const ok = res.ok && data.acknowledge === "success";
  return {
    delivered: ok,
    devMode: false,
    provider: "afromessage",
    ...(ok ? {} : { error: `AfroMessage rejected the message (${res.status})` }),
  };
}

async function sendViaWebhook(to: string, body: string): Promise<SmsResult> {
  const res = await fetch(process.env.SMS_WEBHOOK_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.SMS_WEBHOOK_TOKEN
        ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({ to: toE164(to), message: body }),
  });
  return {
    delivered: res.ok,
    devMode: false,
    provider: "webhook",
    ...(res.ok ? {} : { error: `Gateway returned ${res.status}` }),
  };
}

async function sendViaTwilio(to: string, body: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM!;

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: toE164(to), From: from, Body: body }),
    }
  );
  return {
    delivered: res.ok,
    devMode: false,
    provider: "twilio",
    ...(res.ok ? {} : { error: `Twilio returned ${res.status}` }),
  };
}

/** Send an SMS. Never throws — callers should not fail a payment over an SMS. */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  try {
    if (devModeOn()) {
      console.log(`[SMS dev-mode] to ${to}: ${body}`);
      return { delivered: false, devMode: true, provider: "dev" };
    }
    if (process.env.AFROMESSAGE_TOKEN) return await sendViaAfroMessage(to, body);
    if (process.env.SMS_WEBHOOK_URL) return await sendViaWebhook(to, body);
    if (
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM
    ) {
      return await sendViaTwilio(to, body);
    }
    return {
      delivered: false,
      devMode: false,
      provider: "none",
      error: "No SMS provider configured",
    };
  } catch (e) {
    console.error("SMS send failed:", e);
    return {
      delivered: false,
      devMode: false,
      provider: "error",
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}

/** OTP delivery keeps its own wrapper so the sign-in flow stays unchanged. */
export async function sendOtpSms(
  phone: string,
  code: string
): Promise<{ delivered: boolean; devMode: boolean }> {
  const result = await sendSms(
    phone,
    `${code} is your Degis Tickets code. Valid for 10 minutes.`
  );
  if (!result.delivered && !result.devMode) {
    throw new Error(result.error ?? "SMS delivery failed");
  }
  return { delivered: result.delivered, devMode: result.devMode };
}
