import { env } from '../config/env.js';

type PasswordResetEmailInput = {
  to: string;
  nombre: string;
  resetUrl: string;
};

type SensitiveUserChangeEmailInput = {
  to: string;
  code: string;
  targetUserName: string;
  targetUserEmail: string;
  changeTypeLabel: string;
  previousValueLabel: string;
  requestedValueLabel: string;
  requestedByName: string;
  expiresInMinutes: number;
};

function getEmailFrom() {
  if (!env.EMAIL_FROM) {
    throw new Error('EMAIL_FROM is required to send password reset emails');
  }

  return env.EMAIL_FROM;
}

export function getFrontendBaseUrl() {
  const value = env.FRONTEND_URL || env.NEXT_PUBLIC_SITE_URL || env.SITE_URL || null;
  if (!value) return null;
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export async function sendPasswordResetEmail({ to, nombre, resetUrl }: PasswordResetEmailInput) {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required to send password reset emails');
  }

  const from = getEmailFrom();
  const subject = "Restablece tu contraseña en D'orella";
  const safeName = nombre.trim() || 'cliente';
  const text = [
    `Hola ${safeName},`,
    '',
    "Recibimos una solicitud para restablecer tu contraseña en D'orella.",
    `Abre este enlace para continuar: ${resetUrl}`,
    '',
    'Si no solicitaste este cambio, puedes ignorar este correo.',
    'Este enlace expirará pronto por seguridad.',
  ].join('\n');

  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <title>Recuperación de contraseña</title>
      </head>
      <body
        style="margin:0; padding:0; background-color:#f8f5ef; color:#24181a; font-family:Inter,Arial,sans-serif;"
        bgcolor="#f8f5ef"
      >
        <div
          style="margin:0; padding:32px 16px; background-color:#f8f5ef; color:#24181a;"
          bgcolor="#f8f5ef"
        >
          <table
            role="presentation"
            width="100%"
            cellPadding="0"
            cellSpacing="0"
            border="0"
            style="border-collapse:collapse; background-color:#f8f5ef;"
          >
            <tr>
              <td align="center">
                <table
                  role="presentation"
                  width="100%"
                  cellPadding="0"
                  cellSpacing="0"
                  border="0"
                  style="max-width:560px; border-collapse:separate; border-spacing:0; background-color:#ffffff; border:1px solid #eadfd8; border-radius:20px; overflow:hidden;"
                  bgcolor="#ffffff"
                >
                  <tr>
                    <td
                      style="padding:28px 32px; background-color:#6f0d1b; color:#ffffff;"
                      bgcolor="#6f0d1b"
                    >
                      <div style="font-family:Georgia,'Times New Roman',serif; font-size:28px; margin-bottom:6px; color:#ffffff;">
                        D'orella
                      </div>
                      <div style="font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#f7e7bd;">
                        Recuperación de contraseña
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px; color:#24181a; background-color:#ffffff;" bgcolor="#ffffff">
                      <h1
                        style="margin:0 0 18px; font-family:Georgia,'Times New Roman',serif; font-size:28px; line-height:1.2; color:#24181a; font-weight:600;"
                      >
                        Recuperación de contraseña
                      </h1>
                      <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#24181a;">
                        Hola ${escapeHtml(safeName)},
                      </p>
                      <p style="margin:0 0 24px; font-size:15px; line-height:1.7; color:#24181a;">
                        Recibimos una solicitud para restablecer tu contraseña en D'orella.
                      </p>
                      <table role="presentation" cellPadding="0" cellSpacing="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          <td
                            align="center"
                            style="border-radius:999px; background-color:#6f0d1b;"
                            bgcolor="#6f0d1b"
                          >
                            <a
                              href="${resetUrl}"
                              style="display:inline-block; padding:14px 22px; color:#ffffff; text-decoration:none; font-size:12px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase;"
                            >
                              Restablecer contraseña
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:24px 0 0; font-size:13px; line-height:1.7; color:#6f6668;">
                        Si el botón no funciona, copia y pega este enlace en tu navegador:
                      </p>
                      <p style="margin:8px 0 0; word-break:break-all; font-size:13px; line-height:1.7; color:#6f0d1b;">
                        ${resetUrl}
                      </p>
                      <div style="margin:24px 0; height:1px; background-color:#eadfd8;"></div>
                      <p style="margin:0; font-size:13px; line-height:1.7; color:#6f6668;">
                        Si no solicitaste este cambio, puedes ignorar este correo. El enlace expirará pronto por seguridad.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `.trim();

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send password reset email: ${response.status} ${body}`);
  }
}

export async function sendSensitiveUserChangeCodeEmail({
  to,
  code,
  targetUserName,
  targetUserEmail,
  changeTypeLabel,
  previousValueLabel,
  requestedValueLabel,
  requestedByName,
  expiresInMinutes,
}: SensitiveUserChangeEmailInput) {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required to send sensitive user change emails');
  }

  const from = getEmailFrom();
  const subject = 'Código de autorización para cambio de usuario en Dorella';
  const text = [
    'Se solicitó un cambio sensible de usuario en Dorella.',
    '',
    `Código de autorización: ${code}`,
    `Usuario objetivo: ${targetUserName} (${targetUserEmail})`,
    `Cambio solicitado: ${changeTypeLabel}`,
    `Valor actual: ${previousValueLabel}`,
    `Nuevo valor: ${requestedValueLabel}`,
    `Solicitado por: ${requestedByName}`,
    `Vigencia: ${expiresInMinutes} minutos`,
    '',
    'Si no reconoces esta solicitud, ignora este correo.',
  ].join('\n');

  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <title>Código de autorización</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f8f5ef; color:#24181a; font-family:Inter,Arial,sans-serif;" bgcolor="#f8f5ef">
        <div style="margin:0; padding:32px 16px; background-color:#f8f5ef; color:#24181a;" bgcolor="#f8f5ef">
          <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border="0" style="border-collapse:collapse; background-color:#f8f5ef;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border="0" style="max-width:560px; border-collapse:separate; border-spacing:0; background-color:#ffffff; border:1px solid #eadfd8; border-radius:20px; overflow:hidden;" bgcolor="#ffffff">
                  <tr>
                    <td style="padding:28px 32px; background-color:#6f0d1b; color:#ffffff;" bgcolor="#6f0d1b">
                      <div style="font-family:Georgia,'Times New Roman',serif; font-size:28px; margin-bottom:6px; color:#ffffff;">
                        D'orella
                      </div>
                      <div style="font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#f7e7bd;">
                        Autorización requerida
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px; color:#24181a; background-color:#ffffff;" bgcolor="#ffffff">
                      <h1 style="margin:0 0 18px; font-family:Georgia,'Times New Roman',serif; font-size:28px; line-height:1.2; color:#24181a; font-weight:600;">
                        Código de autorización
                      </h1>
                      <p style="margin:0 0 18px; font-size:15px; line-height:1.7; color:#24181a;">
                        Se solicitó un cambio sensible de usuario en Dorella. Usa este código para autorizarlo:
                      </p>
                      <div style="margin:0 0 24px; padding:18px 20px; border-radius:16px; background-color:#fbf8f2; border:1px solid #eadfd8; text-align:center;">
                        <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#6f6668; margin-bottom:10px;">Código</div>
                        <div style="font-size:34px; line-height:1; letter-spacing:0.24em; font-weight:700; color:#6f0d1b;">${escapeHtml(code)}</div>
                      </div>
                      <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          <td style="padding:0 0 10px; font-size:14px; color:#6f6668;">Usuario objetivo</td>
                          <td style="padding:0 0 10px; font-size:14px; color:#24181a; text-align:right;">${escapeHtml(targetUserName)} (${escapeHtml(targetUserEmail)})</td>
                        </tr>
                        <tr>
                          <td style="padding:0 0 10px; font-size:14px; color:#6f6668;">Cambio solicitado</td>
                          <td style="padding:0 0 10px; font-size:14px; color:#24181a; text-align:right;">${escapeHtml(changeTypeLabel)}</td>
                        </tr>
                        <tr>
                          <td style="padding:0 0 10px; font-size:14px; color:#6f6668;">Valor actual</td>
                          <td style="padding:0 0 10px; font-size:14px; color:#24181a; text-align:right;">${escapeHtml(previousValueLabel)}</td>
                        </tr>
                        <tr>
                          <td style="padding:0 0 10px; font-size:14px; color:#6f6668;">Nuevo valor</td>
                          <td style="padding:0 0 10px; font-size:14px; color:#24181a; text-align:right;">${escapeHtml(requestedValueLabel)}</td>
                        </tr>
                        <tr>
                          <td style="padding:0 0 10px; font-size:14px; color:#6f6668;">Solicitado por</td>
                          <td style="padding:0 0 10px; font-size:14px; color:#24181a; text-align:right;">${escapeHtml(requestedByName)}</td>
                        </tr>
                        <tr>
                          <td style="padding:0; font-size:14px; color:#6f6668;">Vigencia</td>
                          <td style="padding:0; font-size:14px; color:#24181a; text-align:right;">${expiresInMinutes} minutos</td>
                        </tr>
                      </table>
                      <div style="margin:24px 0; height:1px; background-color:#eadfd8;"></div>
                      <p style="margin:0; font-size:13px; line-height:1.7; color:#6f6668;">
                        Si no reconoces esta solicitud, ignora este correo. El código expirará pronto por seguridad.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `.trim();

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send sensitive user change email: ${response.status} ${body}`);
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
