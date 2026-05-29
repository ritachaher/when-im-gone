/**
 * When I'm Gone — Cloud Functions
 *
 * notifyOnSubscriber: fires every time someone opts in for email updates
 * at the end of journal setup. Sends a notification email to
 * info@whenimgone.life via Resend SMTP.
 *
 * Credentials live in functions/.env (never committed to git).
 */

import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as nodemailer from 'nodemailer';

admin.initializeApp();

export const notifyOnSubscriber = onDocumentCreated(
  {
    document: 'subscribers/{docId}',
    region: 'europe-west2',
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const rawEmail = (data.email as string) ?? '';
    // Defence in depth: Firestore rules already validate format, but the
    // function must not trust input. Skip obviously invalid addresses and
    // never inject raw input into the HTML body.
    const isValidEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail) && rawEmail.length < 320;
    if (!isValidEmail) {
      console.warn('notifyOnSubscriber: skipping invalid email payload');
      return;
    }
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const email = rawEmail;
    const emailHtml = escapeHtml(rawEmail);
    const subscribedAt = data.subscribedAt?.toDate?.()?.toISOString() ?? new Date().toISOString();

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.resend.com',
      port: parseInt(process.env.SMTP_PORT ?? '465', 10),
      secure: true,
      auth: {
        user: process.env.SMTP_USER ?? 'resend',
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: '"When I\'m Gone" <info@whenimgone.life>',
      to: 'info@whenimgone.life',
      subject: `New subscriber: ${email}`,
      text: [
        'Someone just opted in for updates at the end of journal setup.',
        '',
        `Email:  ${email}`,
        `Time:   ${subscribedAt}`,
        '',
        '---',
        'View all subscribers: Firebase Console → Firestore → subscribers',
      ].join('\n'),
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1A2438;">
          <div style="background: #2C3E5D; padding: 20px 24px; border-radius: 10px 10px 0 0;">
            <p style="color: #F4EEE2; font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; margin: 0;">When I'm Gone</p>
          </div>
          <div style="background: #ffffff; border: 1px solid #E2D7C0; border-top: none; padding: 28px 24px; border-radius: 0 0 10px 10px;">
            <h2 style="margin: 0 0 16px; font-size: 20px; color: #2C3E5D;">New subscriber</h2>
            <p style="margin: 0 0 20px; color: #45526B;">Someone opted in for updates at the end of journal setup.</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #F0EADF; color: #6B7589; width: 80px;">Email</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #F0EADF; font-weight: 600;">${emailHtml}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #6B7589;">Time</td>
                <td style="padding: 10px 0;">${subscribedAt}</td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 13px; color: #9AA5BC;">
              View all subscribers in
              <a href="https://console.firebase.google.com/" style="color: #C97A5D;">Firebase Console → Firestore → subscribers</a>.
            </p>
          </div>
        </div>
      `,
    });
  },
);
