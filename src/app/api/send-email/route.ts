import nodemailer from "nodemailer";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";
import { withIdempotency } from "@/lib/idempotency";
import { apiResponse, withApiObservability } from "@/lib/observability";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const EMAIL_RATE_LIMIT = 10;
const EMAIL_RATE_WINDOW_MS = 60 * 60 * 1000;
const SMTP_FAILURE_THRESHOLD = 5;
const SMTP_CIRCUIT_COOLDOWN_MS = 60 * 1000;
const SAFE_EMAIL_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "ul", "ol", "li"]);

let consecutiveSmtpFailures = 0;
let smtpCircuitOpenUntil = 0;

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
    },
});

function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function sanitizeEmailHtml(value: string): string {
    const tokenPattern = /<[^>]*>/g;
    let result = "";
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenPattern.exec(value)) !== null) {
        result += escapeHtml(value.slice(cursor, match.index));
        const tagMatch = match[0].match(/^<\s*(\/?)\s*([a-z][a-z0-9]*)\b[^>]*>$/i);
        if (tagMatch) {
            const tagName = tagMatch[2].toLowerCase();
            if (SAFE_EMAIL_TAGS.has(tagName)) {
                result += tagName === "br"
                    ? "<br>"
                    : `<${tagMatch[1] ? "/" : ""}${tagName}>`;
            }
        } else {
            result += escapeHtml(match[0]);
        }
        cursor = tokenPattern.lastIndex;
    }

    return result + escapeHtml(value.slice(cursor));
}

function normalizeRecipientEmails(value: unknown): string[] {
    const emailList = Array.isArray(value)
        ? value
        : typeof value === "string"
            ? [value]
            : [];

    return emailList
        .map((email) => String(email).trim())
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

class SendEmailError extends Error {
    constructor(message: string, readonly status: number, readonly step: string) {
        super(message);
        this.name = "SendEmailError";
    }
}

function isInvalidIdTokenError(error: unknown): boolean {
    if (!isRecord(error) || typeof error.code !== "string") return false;
    return new Set([
        "auth/argument-error",
        "auth/id-token-expired",
        "auth/id-token-revoked",
        "auth/invalid-id-token",
        "auth/user-disabled",
        "auth/user-not-found",
    ]).has(error.code);
}

async function authorizeRequest(
    request: Request
): Promise<{ allowedRecipients: Set<string>; uid: string }> {
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!token) {
        throw new SendEmailError("Sign in before sending email notifications.", 401, "authorization");
    }

    let decodedToken: Awaited<ReturnType<ReturnType<typeof getAdminAuth>["verifyIdToken"]>>;
    try {
        decodedToken = await getAdminAuth().verifyIdToken(token, true);
    } catch (error) {
        const invalidToken = isInvalidIdTokenError(error);
        throw new SendEmailError(
            invalidToken
                ? "The session is invalid or expired. Sign in again."
                : "Could not verify your session right now. Try again.",
            invalidToken ? 401 : 503,
            "token-verification"
        );
    }
    if (decodedToken.email_verified !== true || !decodedToken.email) {
        throw new SendEmailError("A verified system account is required.", 403, "account-validation");
    }

    let membersSnapshot;
    try {
        membersSnapshot = await getAdminFirestore().doc("settings/members").get();
    } catch {
        throw new SendEmailError("The member directory is temporarily unavailable.", 503, "member-lookup");
    }
    const members = membersSnapshot.data()?.members;
    if (!Array.isArray(members)) {
        throw new SendEmailError("The member directory is temporarily unavailable.", 503, "member-lookup");
    }

    const allowedRecipients = new Set(
        members
            .filter((member) =>
                member &&
                typeof member === "object" &&
                member.status !== "inactive" &&
                member.status !== "removed" &&
                member.active !== false &&
                member.isBlocked !== true &&
                member.isRemoved !== true &&
                typeof member.email === "string"
            )
            .map((member) => String(member.email).trim().toLowerCase())
            .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    );

    const superAdminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "").trim().toLowerCase();
    const callerEmail = decodedToken.email.trim().toLowerCase();
    if (!allowedRecipients.has(callerEmail) && callerEmail !== superAdminEmail) {
        throw new SendEmailError("The account is not an active system member.", 403, "account-validation");
    }

    return { allowedRecipients, uid: decodedToken.uid };
}

async function consumeEmailRateLimit(
    uid: string
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const firestore = getAdminFirestore();
    const rateLimitRef = firestore.doc(`rate_limits/email_${encodeURIComponent(uid)}`);

    return firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(rateLimitRef);
        const now = Date.now();
        const windowStartedAt = snapshot.get("windowStartedAt");
        const count = snapshot.get("count");
        const windowStart = typeof windowStartedAt === "number" ? windowStartedAt : 0;
        const requestCount = typeof count === "number" ? count : 0;

        if (!snapshot.exists || now - windowStart >= EMAIL_RATE_WINDOW_MS || now < windowStart) {
            transaction.set(rateLimitRef, { windowStartedAt: now, count: 1 });
            return { allowed: true, retryAfterSeconds: 0 };
        }
        if (requestCount >= EMAIL_RATE_LIMIT) {
            return {
                allowed: false,
                retryAfterSeconds: Math.max(
                    1,
                    Math.ceil((windowStart + EMAIL_RATE_WINDOW_MS - now) / 1000)
                ),
            };
        }

        transaction.update(rateLimitRef, { count: requestCount + 1 });
        return { allowed: true, retryAfterSeconds: 0 };
    });
}

function buildModernHtmlTemplate({
    title,
    summary,
    amount,
    date,
    description,
}: {
    title: string;
    summary: string;
    amount?: string;
    date?: string;
    description?: string;
}) {
    const details = [
        { label: "Member", value: escapeHtml(summary) },
        ...(amount ? [{ label: "Amount", value: escapeHtml(amount) }] : []),
        ...(date ? [{ label: "Date", value: escapeHtml(date) }] : []),
        ...(description ? [{ label: "Note", value: escapeHtml(description) }] : []),
    ];

    const rows = details
        .map(
            (detail) => `
                <tr>
                  <td style="padding:14px 18px; border-bottom:1px solid #edf2f7; font-size:12px; letter-spacing:0.06em; text-transform:uppercase; color:#64748b; font-weight:700;">${detail.label}</td>
                  <td style="padding:14px 18px; border-bottom:1px solid #edf2f7; font-size:14px; line-height:1.6; color:#0f172a; font-weight:600;">${detail.value}</td>
                </tr>
            `
        )
        .join("");

    return `
        <div style="margin:0; padding:32px 16px; background:#f4f6f9; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#0f172a;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:680px; margin:0 auto; border-collapse:separate; border-spacing:0;">
            <tr>
              <td>
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; box-shadow:0 12px 28px rgba(15, 23, 42, 0.08);">
                  <div style="height:6px; background:#4f46e5; width:100%;"></div>
                  <div style="padding:28px 28px 20px; background:#ffffff; border-bottom:1px solid #edf2f7;">
                    <div style="display:inline-block; background:#eef2ff; color:#4f46e5; border-radius:999px; padding:7px 12px; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">
                      Mess App
                    </div>
                    <h1 style="margin:18px 0 10px; font-size:30px; line-height:1.2; color:#0f172a; font-weight:700; letter-spacing:-0.03em;">${title}</h1>
                    <p style="margin:0; color:#475569; font-size:15px; line-height:1.7;">${summary}</p>
                  </div>
                  <div style="padding:0 28px 18px; background:#ffffff;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; margin-top:18px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                      <tbody>
                        ${rows}
                      </tbody>
                    </table>
                  </div>
                  <div style="padding:18px 28px 26px; background:#ffffff; color:#64748b; font-size:12px; line-height:1.7; border-top:1px solid #edf2f7; text-align:center;">
                    Mess Management Notification • Automatically generated message
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </div>
    `;
}

function getSmtpCircuitRetryAfter(now = Date.now()): number {
    if (smtpCircuitOpenUntil <= now) {
        smtpCircuitOpenUntil = 0;
        consecutiveSmtpFailures = 0;
        return 0;
    }
    return Math.max(1, Math.ceil((smtpCircuitOpenUntil - now) / 1000));
}

function recordSmtpFailure(now = Date.now()) {
    consecutiveSmtpFailures += 1;
    if (consecutiveSmtpFailures >= SMTP_FAILURE_THRESHOLD) {
        smtpCircuitOpenUntil = now + SMTP_CIRCUIT_COOLDOWN_MS;
    }
}

function recordSmtpSuccess() {
    consecutiveSmtpFailures = 0;
    smtpCircuitOpenUntil = 0;
}

async function sendEmailAuthorized(
    request: Request,
    authorization: { allowedRecipients: Set<string>; uid: string }
): Promise<Response> {
    let parsedBody: unknown;
    try {
        parsedBody = await request.json();
    } catch {
        return apiResponse(
            { ok: false, error: "A valid JSON request body is required.", step: "body-parsing" },
            400,
            "body-parsing"
        );
    }
    const body = isRecord(parsedBody) ? parsedBody : {};
    const recipientEmails = normalizeRecipientEmails(
        body.emails ?? body.email ?? body.recipientEmail
    ).map((email) => email.toLowerCase());

    if (recipientEmails.some((email) => !authorization.allowedRecipients.has(email))) {
        return apiResponse(
            { ok: false, error: "Recipients must be active members of the mess.", step: "recipient-validation" },
            403,
            "recipient-validation"
        );
    }
    if (recipientEmails.length > 20) {
        return apiResponse(
            { ok: false, error: "Too many recipients.", step: "recipient-validation" },
            400,
            "recipient-validation"
        );
    }
    if (recipientEmails.length === 0) {
        return apiResponse({ ok: true, sent: 0, message: "No recipient emails provided." });
    }
    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
        return apiResponse({
            ok: true,
            sent: 0,
            skipped: true,
            message: "Email service is not configured.",
        });
    }

    const circuitRetryAfter = getSmtpCircuitRetryAfter();
    if (circuitRetryAfter > 0) {
        return apiResponse(
            {
                ok: false,
                error: "Email delivery is temporarily unavailable. Try again shortly.",
                step: "smtp-circuit-open",
            },
            503,
            "smtp-circuit-open",
            { "Retry-After": String(circuitRetryAfter) }
        );
    }

    let emailLimit: { allowed: boolean; retryAfterSeconds: number };
    try {
        emailLimit = await consumeEmailRateLimit(authorization.uid);
    } catch {
        return apiResponse(
            { ok: false, error: "Email service is temporarily unavailable. Try again later.", step: "email-rate-limit" },
            503,
            "email-rate-limit"
        );
    }
    if (!emailLimit.allowed) {
        return rateLimitResponse(
            emailLimit.retryAfterSeconds,
            "Email sending limit reached. Try again later."
        );
    }

    const subject = typeof body.subject === "string" && body.subject.trim().length > 0
        ? body.subject.trim().slice(0, 200)
        : "Mess App Notification";
    const html = typeof body.html === "string" && body.html.trim().length > 0
        ? sanitizeEmailHtml(body.html)
        : buildModernHtmlTemplate({
            title: "Mess App Update",
            summary: "Your latest mess update is ready.",
            date: new Date().toLocaleDateString(),
        });
    const text = [
        "Mess App Update",
        "Your latest mess update is ready.",
        `Date: ${new Date().toLocaleDateString()}`,
    ].join("\n");

    try {
        const info = await transporter.sendMail({
            from: `Mess App <${process.env.SMTP_EMAIL}>`,
            to: recipientEmails,
            subject,
            text,
            html,
            headers: {
                "X-Priority": "3",
                "X-MSMail-Priority": "Normal",
                Importance: "Normal",
                "X-Mailer": "Nodemailer",
            },
        });
        recordSmtpSuccess();
        return apiResponse({
            ok: true,
            sent: recipientEmails.length,
            messageId: info.messageId ?? null,
        });
    } catch {
        recordSmtpFailure();
        return apiResponse(
            { ok: false, error: "Email delivery failed. The data change was saved, but its notification could not be sent.", step: "smtp-send" },
            502,
            "smtp-send"
        );
    }
}

export async function POST(request: Request) {
    return withApiObservability(request, "/api/send-email", async () => {
        let authorization: { allowedRecipients: Set<string>; uid: string };
        try {
            authorization = await authorizeRequest(request);
        } catch (error) {
            if (error instanceof SendEmailError) {
                return apiResponse(
                    { ok: false, error: error.message, step: error.step },
                    error.status,
                    error.step
                );
            }
            return apiResponse(
                { ok: false, error: "Email authorization is temporarily unavailable.", step: "authorization" },
                503,
                "authorization"
            );
        }

        return withIdempotency(request, `send-email:${authorization.uid}`, async () => {
            const localLimit = consumeRateLimit(
                `send-email:${authorization.uid}`,
                { limit: EMAIL_RATE_LIMIT, windowMs: EMAIL_RATE_WINDOW_MS }
            );
            if (!localLimit.allowed) {
                return rateLimitResponse(
                    localLimit.retryAfterSeconds,
                    "Email sending limit reached. Try again later."
                );
            }
            return sendEmailAuthorized(request, authorization);
        });
    });
}
