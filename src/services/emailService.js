const nodemailer = require('nodemailer');
const AWS = require('@aws-sdk/client-ses');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    if (process.env.EMAIL_PROVIDER === 'ses') {
      this.initializeSES();
    } else {
      this.initializeSMTP();
    }
  }

  initializeSES() {
    this.ses = new AWS.SES({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });
  }

  initializeSMTP() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async loadTemplate(templateName) {
    const filePath = path.join(__dirname, '../templates/emails', `${templateName}.hbs`);
    const template = await fs.readFile(filePath, 'utf-8');
    return handlebars.compile(template);
  }

  async sendEmail(to, subject, templateName, data) {
    try {
      const template = await this.loadTemplate(templateName);
      const html = template(data);

      if (process.env.EMAIL_PROVIDER === 'ses') {
        await this.sendWithSES(to, subject, html);
      } else {
        await this.sendWithSMTP(to, subject, html);
      }

      logger.info(`Email sent successfully to ${to}`);
    } catch (error) {
      logger.error('Email sending error:', error);
      throw error;
    }
  }

  async sendWithSES(to, subject, html) {
    const params = {
      Source: process.env.EMAIL_FROM,
      Destination: {
        ToAddresses: [to]
      },
      Message: {
        Subject: {
          Data: subject
        },
        Body: {
          Html: {
            Data: html
          }
        }
      }
    };

    await this.ses.sendEmail(params).promise();
  }

  async sendWithSMTP(to, subject, html) {
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html
    });
  }

  // Predefined email methods
  async sendWelcomeEmail(user) {
    await this.sendEmail(
      user.email,
      'Welcome to Mymovingmaps',
      'welcome',
      {
        name: user.firstName,
        loginUrl: `${process.env.FRONTEND_URL}/login`
      }
    );
  }

  async sendPasswordResetEmail(user, token) {
    await this.sendEmail(
      user.email,
      'Reset Your Password',
      'password-reset',
      {
        name: user.firstName,
        resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${token}`
      }
    );
  }

  async sendLoadRequestNotification(user, load) {
    await this.sendEmail(
      user.email,
      'New Load Request',
      'load-request',
      {
        name: user.firstName,
        loadId: load.id,
        pickupLocation: load.pickupLocation,
        deliveryLocation: load.deliveryLocation
      }
    );
  }
}

module.exports = new EmailService(); 