/**
 * SMS adapter.
 *  - Dev mode (OTP_DEV_MODE=true): nothing is sent; the caller shows the code
 *    on screen. Comparison is case/whitespace tolerant on purpose — an env var
 *    saved as "TRUE" silently broke sign-in once.
 *  - Twilio (TWILIO_* set): real SMS, useful for testing with any number.
 *  - Phase 1.5: add an Ethio Telecom / Safaricom aggregator here.
 */
export async function sendOtpSms(
  phone: string,
  code: string
): Promise<{ delivered: boolean; devMode: boolean }> {
  if (process.env.OTP_DEV_MODE?.toLowerCase().trim() === "true") {
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
