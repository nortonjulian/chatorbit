import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_HOST ? Number(process.env.SMTP_HOST) : 587,
  auth: {
    user: process.env.ETHEREAL_USER,
    pass: process.env.ETHEREAL_PASS,
  },
});

export async function sendMail(to, subject, html) {
  try {
    const info = await transporter.sendMail({
      from: `"ChatOrbit Support" <${process.env.SUPPORT_EMAIL || 'support@chatorbit.com'}>`,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent: ${info.messageId}`);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewURL) console.log(`Preview URL: ${previewUrl}`);

    return { success: true, info, previewUrl };
  } catch (error) {
    console.log('Error sending email', error);
    return { success: false, error };
  }
}
