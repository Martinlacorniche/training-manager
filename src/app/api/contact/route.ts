import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { prenom, email, sport, message } = await req.json();

  if (!prenom || !email || !sport) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }

  const { error } = await resend.emails.send({
    from: "C'est Ludique <onboarding@resend.dev>",
    to: "martinvitte@gmail.com",
    subject: `Nouvelle demande de ${prenom} — C'est Ludique`,
    html: `
      <h2>Nouvelle demande d'un athlète sans coach</h2>
      <p><strong>Prénom :</strong> ${prenom}</p>
      <p><strong>Email :</strong> ${email}</p>
      <p><strong>Sport(s) :</strong> ${sport}</p>
      <p><strong>Message :</strong> ${message || "—"}</p>
    `,
  });

  if (error) {
    return NextResponse.json({ error: "Erreur envoi email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
