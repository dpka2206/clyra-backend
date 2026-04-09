export class EmailService {
  async sendEmail(email: string, subject: string, body: string) {
    return {
      provider: "email",
      delivered: false,
      email,
      subject,
      body,
      note: "Email transport not configured yet. Notification recorded only.",
    };
  }
}

export const emailService = new EmailService();
