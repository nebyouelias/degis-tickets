/**
 * SMS adapter.
 * - Dev mode (OTP_DEV_MODE=true): no SMS sent; caller shows the code on-screen.
 * - Twilio (TWILIO_* env vars set): sends real SMS — used for testing with
 *   US/international numbers before we contract an Ethiopian aggregator.
 * - Phase 1.5 adds an Ethio Telecom / Safaricom aggregator implementation here.
 */
export async function sendOtpSms(
  phone: string,
  code: string
): Promise<{ delivered: boolean; devMode: boolean }> {
  if (process.env.OTP_DEV_MODE === "true") {
    return { delivered: false, devMode: true };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (sid && token && from) {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: phone,
          From: from,
          Body: `${code} is your Degis Tickets code. Valid for 10 minutes. ድግስ`,
        }),
      }
    );
    return { delivered: res.ok, devMode: false };
  }

  throw new Error(
    "No SMS provider configured. Set OTP_DEV_MODE=true or TWILIO_* env vars."
  );
}
