const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'NoteSync <noreply@notesync.9gg.app>';
const APP_URL = process.env.FRONTEND_URL || 'https://notesync.9gg.app';

async function sendVerificationEmail(email, token) {
  const verifyUrl = `${APP_URL}/verify?token=${token}`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Verify your NoteSync account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                  <!-- Header -->
                  <tr>
                    <td style="padding:40px 32px 24px;text-align:center;">
                      <div style="width:56px;height:56px;border-radius:16px;background:rgba(45,190,96,0.1);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
                        <span style="font-size:28px;">&#128221;</span>
                      </div>
                      <h1 style="margin:0;font-size:24px;font-weight:700;color:#1a1a1a;">NoteSync</h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding:0 32px 32px;">
                      <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#1a1a1a;text-align:center;">Verify your email</h2>
                      <p style="margin:0 0 28px;font-size:15px;color:#525e63;line-height:1.6;text-align:center;">
                        Thanks for signing up! Please verify your email address to get started with NoteSync.
                      </p>

                      <!-- Button -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${verifyUrl}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;color:#ffffff;background:#2dbe60;border-radius:8px;text-decoration:none;">
                              Verify Email Address
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:28px 0 0;font-size:13px;color:#aeb6b8;text-align:center;line-height:1.5;">
                        This link expires in 24 hours. If you didn't create a NoteSync account, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
                      <p style="margin:0;font-size:12px;color:#aeb6b8;">
                        NoteSync &mdash; Your notes, everywhere you need them.
                      </p>
                    </td>
                  </tr>

                </table>

                <!-- Fallback link -->
                <p style="margin:24px 0 0;font-size:12px;color:#aeb6b8;text-align:center;word-break:break-all;">
                  Button not working? Copy and paste this URL:<br>
                  <a href="${verifyUrl}" style="color:#2dbe60;">${verifyUrl}</a>
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error };
    }

    console.log('Verification email sent:', data?.id);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('Email send failed:', err);
    return { success: false, error: err.message };
  }
}

module.exports = { sendVerificationEmail };
