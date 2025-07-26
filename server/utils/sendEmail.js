import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
        user: process.env.ETHEREAL_USER,
        pass: process.env.ETHEREAL_PASS,
    },
})

export async function sendEmail(to, subject, html) {
    try {
        const info = await transporter.sendEmail({
            from: '"ChatOrbit Support" <support@chatorbit.com>',
            to,
            subject,
            html,
        })
        console.log(`📧 Email sent: ${info.messageId}`);
        console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    } catch (error) {
        console.log('Error sending email', error)
    }
}