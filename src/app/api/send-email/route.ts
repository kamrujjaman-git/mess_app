import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";

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

async function authorizeRequest(request: Request): Promise<Set<string>> {
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!token) {
        throw new Error("Missing Firebase ID token.");
    }

    const decodedToken = await getAdminAuth().verifyIdToken(token);
    if (decodedToken.email_verified !== true || !decodedToken.email) {
        throw new Error("A verified system account is required.");
    }

    const membersSnapshot = await getAdminFirestore().doc("settings/members").get();
    const members = membersSnapshot.data()?.members;
    if (!Array.isArray(members)) {
        throw new Error("System member directory is unavailable.");
    }

    const allowedRecipients = new Set(
        members
            .filter((member) =>
                member &&
                typeof member === "object" &&
                member.status === "active" &&
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
        throw new Error("The account is not an active system member.");
    }

    return allowedRecipients;
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

export async function POST(request: Request) {
    try {
        let allowedRecipients: Set<string>;
        try {
            allowedRecipients = await authorizeRequest(request);
        } catch (authorizationError) {
            return NextResponse.json(
                { ok: false, error: authorizationError instanceof Error ? authorizationError.message : "Unauthorized" },
                { status: 401 }
            );
        }

        const body = (await request.json().catch(() => ({}))) ?? {};
        const recipientEmails = normalizeRecipientEmails(body.emails ?? body.email ?? body.recipientEmail)
            .map((email) => email.toLowerCase());
        if (recipientEmails.some((email) => !allowedRecipients.has(email))) {
            return NextResponse.json(
                { ok: false, error: "Recipients must be active members of the mess." },
                { status: 403 }
            );
        }

        if (recipientEmails.length > 20) {
            return NextResponse.json(
                { ok: false, error: "Too many recipients." },
                { status: 400 }
            );
        }

        if (recipientEmails.length === 0) {
            return NextResponse.json({ ok: true, sent: 0, message: "No recipient emails provided." });
        }

        if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
            console.warn("SMTP credentials are not set; skipping email send.");
            return NextResponse.json({
                ok: true,
                sent: 0,
                skipped: true,
                message: "Email service is not configured.",
            });
        }

        const subject = typeof body.subject === "string" && body.subject.trim().length > 0
            ? body.subject.trim().slice(0, 200)
            : "Mess App Notification";
        const html = typeof body.html === "string" && body.html.trim().length > 0
            ? escapeHtml(body.html)
            : buildModernHtmlTemplate({
                title: "Mess App Update",
                summary: "Your latest mess update is ready.",
                date: new Date().toLocaleDateString(),
            });
        const text = [
            `Mess App Update`,
            `Your latest mess update is ready.`,
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

            return NextResponse.json({
                ok: true,
                sent: recipientEmails.length,
                messageId: info.messageId ?? null,
            });
        } catch (sendError) {
            console.error("SMTP send exception:", sendError);
            return NextResponse.json(
                {
                    ok: false,
                    error: sendError instanceof Error ? sendError.message : "Email delivery failed.",
                },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error("send-email route failed:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
