export class TwilioService {
  async sendSms(phone: string, message: string) {
    return {
      provider: "twilio",
      delivered: false,
      phone,
      message,
      note: "Twilio credentials not configured yet. Notification recorded only.",
    };
  }
}

export const twilioService = new TwilioService();
