const nodemailer = require('nodemailer');
console.log(process.env.SMTP_USER, "process.env.SMTP_USER")
// Create transporter using Postmark settings
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,    
        pass: process.env.SMTP_PASS     
    },
    requireTLS: true,
    tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
        ciphers: 'HIGH:MEDIUM:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA'
    },
    debug: true, // Enable debug logs
    logger: true // Enable logger
});

// Send email function
exports.sendEmail = async ({ to, subject, html }) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to,
            subject,
            html
        };

        console.log('Attempting to send email with options:', {
            from: process.env.EMAIL_FROM,
            to,
            subject,
            smtpHost: process.env.SMTP_HOST,
            smtpPort: process.env.SMTP_PORT
        });

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully. Full response:', {
            messageId: info.messageId,
            response: info.response,
            envelope: info.envelope
        });
        return info;
    } catch (error) {
        console.error('Email sending failed. Detailed error:', {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack,
            errorCode: error.code
        });
        throw error;
    }
}; 