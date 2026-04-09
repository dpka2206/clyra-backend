import { GoogleGenerativeAI } from "@google/generative-ai";

import { env } from "../../config/env.js";

export type ExtractedIntakePayload = {
  patient: {
    name?: string;
    phone?: string;
    email?: string;
    age?: number;
    gender?: string;
  };
  visit: {
    reasonForVisit: string;
    symptoms?: string[];
    preferredSlot?: string;
  };
  fourKeySummary?: {
    chronicConditions?: string;
    allergies?: string;
    currentMedications?: string;
    vitals?: string;
  };
};

export type ConsultationProcessPayload = {
  transcript: string;
  caseSummary: string;
  sourceLanguages: string[];
  prescriptionNarrative: string;
  prescriptions: Array<{
    medicineName: string;
    dosage?: string;
    frequency?: string;
    timing?: string;
  }>;
  fourKeySummary: {
    chronicConditions?: string;
    allergies?: string;
    currentMedications?: string;
    vitals?: string;
  };
};

export class GeminiService {
  private client = env.GEMINI_API_KEY ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null;

  async transcribeConsultationAudio(audioBuffer: Buffer, mimeType: string) {
    if (!this.client) {
      throw new Error("GEMINI_API_KEY is required for audio transcription");
    }

    const model = this.client.getGenerativeModel({ model: env.GEMINI_MODEL });
    const prompt = `
You are transcribing a full OP consultation between a doctor and a patient.

Rules:
- the audio may contain English, Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, or Bengali
- the conversation may switch between English and regional languages in the same sentence
- return a clean, readable transcript in English
- preserve medicine names, symptoms, dosage instructions, and clinically important details
- if a short regional phrase has no exact English equivalent, translate it to the closest clinical meaning
- do not summarize here, only transcribe the whole conversation

Return only the transcript text.
    `.trim();

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: audioBuffer.toString("base64"),
        },
      },
    ]);

    return result.response.text().trim();
  }

  async extractAppointmentIntake(transcript: string): Promise<ExtractedIntakePayload> {
    if (!this.client) {
      return {
        patient: {},
        visit: {
          reasonForVisit: transcript.slice(0, 300),
        },
      };
    }

    const model = this.client.getGenerativeModel({ model: env.GEMINI_MODEL });
    const prompt = `
You are an intake parser for a hospital OP appointment workflow.
Return ONLY valid JSON with this exact shape:
{
  "patient": {
    "name": "string or omitted",
    "phone": "string or omitted",
    "email": "string or omitted",
    "age": 0,
    "gender": "string or omitted"
  },
  "visit": {
    "reasonForVisit": "string",
    "symptoms": ["string"],
    "preferredSlot": "HH:mm or omitted"
  },
  "fourKeySummary": {
    "chronicConditions": "string or omitted",
    "allergies": "string or omitted",
    "currentMedications": "string or omitted",
    "vitals": "string or omitted"
  }
}

Transcript:
${transcript}
    `.trim();

    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");

    return JSON.parse(cleaned) as ExtractedIntakePayload;
  }

  async processConsultationTranscript(transcript: string): Promise<ConsultationProcessPayload> {
    if (!this.client) {
      return {
        transcript,
        caseSummary: transcript.slice(0, 500),
        sourceLanguages: ["unknown"],
        prescriptionNarrative: "Prescription details could not be auto-extracted without Gemini configuration.",
        prescriptions: [],
        fourKeySummary: {},
      };
    }

    const model = this.client.getGenerativeModel({ model: env.GEMINI_MODEL });
    const prompt = `
You are a medical OP consultation summarizer and prescription extractor.
The transcript may contain:
- full conversation between doctor and patient
- English mixed with Indian regional languages
- code-switching inside the same sentence
- transliterated medicine names or symptoms
- prescription instructions spoken casually

Important rules:
- understand Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Bengali, and mixed English usage
- do NOT lose meaning from regional-language segments
- normalize the transcript into a clean readable consultation transcript in English while preserving medicine names, symptoms, and clinically relevant phrasing
- if a medicine or instruction is unclear, keep the best safe interpretation and mention uncertainty inside "prescriptionNarrative"
- extract any prescription spoken anywhere in the conversation, even if mentioned near the end
- keep the summary medically concise and CRM-friendly

Return ONLY valid JSON with this exact shape:
{
  "transcript": "string",
  "caseSummary": "string",
  "sourceLanguages": ["string"],
  "prescriptionNarrative": "string",
  "prescriptions": [
    {
      "medicineName": "string",
      "dosage": "string",
      "frequency": "string",
      "timing": "string"
    }
  ],
  "fourKeySummary": {
    "chronicConditions": "string",
    "allergies": "string",
    "currentMedications": "string",
    "vitals": "string"
  }
}

Transcript:
${transcript}
    `.trim();

    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");

    return JSON.parse(cleaned) as ConsultationProcessPayload;
  }

  async processConsultationAudio(audioBuffer: Buffer, mimeType: string) {
    const transcript = await this.transcribeConsultationAudio(audioBuffer, mimeType);
    return this.processConsultationTranscript(transcript);
  }
}

export const geminiService = new GeminiService();
