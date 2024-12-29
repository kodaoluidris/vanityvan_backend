const nodemailer = require('nodemailer');
console.log(process.env.SMTP_USER, "process.env.SMTP_USER")
// Create transporter using Mailtrap settings
const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 587,  // Important: Use port 2525 for Mailtrap
    secure: false,
    auth: {
        user: process.env.SMTP_USER,    // "y27a54c7306b72b"
        pass: process.env.SMTP_PASS     // "58ad334b2f6841"
    }
});

// Send email function
exports.sendEmail = async ({ to, subject, html }) => {
    try {
        const mailOptions = {
            from: process.env.SMTP_FROM,
            to,
            subject,
            html
        };

        console.log('Mail configuration:', {
            host: process.env.SMTP_HOST,
            port: '2525',
            user: process.env.SMTP_USER
        });

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('Email sending failed:', error);
        throw error;
    }
}; 