const nodemailer = require('nodemailer');

let transporter;

const getTransportConfig = () => {
    const service = process.env.MAIL_SERVICE;

    if (service === 'gmail') {
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            throw new Error('Gmail SMTP is not configured.');
        }

        return {
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        };
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw new Error('SMTP is not configured.');
    }

    return {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    };
};

const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport(getTransportConfig());
    }

    return transporter;
};

const buildFromAddress = () => {
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    const fromName = process.env.SMTP_FROM_NAME || 'Smart Tech Lab';

    if (!fromEmail) {
        throw new Error('SMTP sender email is not configured.');
    }

    return `"${fromName}" <${fromEmail}>`;
};

const sendEmail = async ({ to, subject, text, html }) => {
    const mailer = getTransporter();
    try {
        await mailer.sendMail({
            from: buildFromAddress(),
            to,
            subject,
            text,
            html
        });
    } catch (error) {
        if (process.env.MAIL_SERVICE === 'gmail' && /invalid login|application-specific password required/i.test(error.message || '')) {
            throw new Error('Email sending is not configured correctly. For Gmail, set SMTP_PASS to a 16-digit Google App Password and restart the backend.');
        }

        throw error;
    }
};

module.exports = { sendEmail };
