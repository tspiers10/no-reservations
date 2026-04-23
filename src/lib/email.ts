import { Resend } from "resend";

// Using Resend's shared test domain for now — swap for verified domain before launch
const FROM = "No Reservations <onboarding@resend.dev>";

export async function sendNewSubmissionEmail(submission: {
  name: string;
  address: string;
  cuisine_type?: string | null;
  walk_in_status: string;
  note?: string | null;
  submitterEmail: string;
}) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL!;

  const statusLabels: Record<string, string> = {
    walk_in_only:          "Walk-in only",
    bar_seating:           "Bar seating only",
    large_parties_only:    "Walk-in for 1–4",
    reservations_required: "Reservations required",
  };

  const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://no-reservations-vert.vercel.app"}/admin/submissions`;

  await resend.emails.send({
    from: FROM,
    to: FOUNDER_EMAIL,
    subject: `🍽️ New restaurant suggestion — ${submission.name}`,
    html: `
      <h2>New restaurant suggestion</h2>
      <p>A community member has suggested a restaurant for review.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px">
        <tbody>
          <tr style="background:#f9f9f9">
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;width:140px">Name</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${submission.name}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">Address</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${submission.address}</td>
          </tr>
          <tr style="background:#f9f9f9">
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">Walk-in status</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${statusLabels[submission.walk_in_status] ?? submission.walk_in_status}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">Cuisine</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${submission.cuisine_type ?? "—"}</td>
          </tr>
          <tr style="background:#f9f9f9">
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">Note</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${submission.note ?? "—"}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:600">Submitted by</td>
            <td style="padding:8px 12px;color:#666">${submission.submitterEmail}</td>
          </tr>
        </tbody>
      </table>
      <p>
        <a href="${adminUrl}" style="display:inline-block;padding:10px 20px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
          Review submission →
        </a>
      </p>
    `,
  });
}


export async function sendDailyDigest(confirmations: {
  restaurant_name: string;
  status_submitted: string;
  note: string | null;
  created_at: string;
  user_email: string;
}[]) {
  if (confirmations.length === 0) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL!;

  const statusLabels: Record<string, string> = {
    still_walk_in:         "Still walk-in ✓",
    walk_in_only:          "Changed → Walk-in only",
    bar_seating:           "Changed → Bar seating only",
    large_parties_only:    "Changed → Walk-in for 1–4",
    reservations_required: "Changed → Reservations required",
  };

  const changed = confirmations.filter((c) => c.status_submitted !== "still_walk_in");
  const confirmed = confirmations.filter((c) => c.status_submitted === "still_walk_in");

  const row = (c: typeof confirmations[0], highlight: boolean) => `
    <tr style="${highlight ? "background:#fff8f0;" : ""}">
      <td style="padding:8px;border-bottom:1px solid #eee">${highlight ? "⚠️ " : ""}${c.restaurant_name}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${statusLabels[c.status_submitted] ?? c.status_submitted}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${c.note ?? "—"}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#999;font-size:12px">${c.user_email}</td>
    </tr>
  `;

  const rows = [
    ...changed.map((c) => row(c, true)),
    ...confirmed.map((c) => row(c, false)),
  ].join("");

  await resend.emails.send({
    from: FROM,
    to: FOUNDER_EMAIL,
    subject: changed.length > 0
      ? `⚠️ No Reservations — ${changed.length} status change${changed.length === 1 ? "" : "s"} + ${confirmed.length} confirmation${confirmed.length === 1 ? "" : "s"} today`
      : `No Reservations — ${confirmations.length} confirmation${confirmations.length === 1 ? "" : "s"} today`,
    html: `
      <h2>Daily digest</h2>
      <p>${confirmations.length} confirmation${confirmations.length === 1 ? "" : "s"} in the last 24 hours.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px;text-align:left">Restaurant</th>
            <th style="padding:8px;text-align:left">Status</th>
            <th style="padding:8px;text-align:left">Note</th>
            <th style="padding:8px;text-align:left">User</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `,
  });
}
