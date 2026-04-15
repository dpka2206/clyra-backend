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
  summarySections: {
    presentingComplaints: string;
    clinicalFindings: string;
    assessmentAndAdvice: string;
    medicinesPrescribed: string;
  };
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

  private async wait(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async generateContentWithFallback(
    contents:
      | string
      | Array<
          | { text: string }
          | {
              inlineData: {
                data: string;
                mimeType: string;
              };
            }
        >,
  ) {
    if (!this.client) {
      throw new Error("GEMINI_API_KEY is required for Gemini generation");
    }

    const candidates = [...new Set([env.GEMINI_MODEL, "gemini-2.0-flash", "gemini-1.5-flash-latest"])];
    let lastError: unknown = null;

    for (const modelName of candidates) {
      try {
        const model = this.client.getGenerativeModel({ model: modelName });
        return await model.generateContent(contents);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Unable to generate content with any configured Gemini model");
  }

  private stripMarkdownFences(value: string) {
    return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  }

  private extractJsonObject(value: string) {
    const firstBrace = value.indexOf("{");
    const lastBrace = value.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    return value.slice(firstBrace, lastBrace + 1);
  }

  private extractJsonArray(value: string) {
    const firstBracket = value.indexOf("[");
    const lastBracket = value.lastIndexOf("]");

    if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
      return null;
    }

    return value.slice(firstBracket, lastBracket + 1);
  }

  private parseLabeledSections(value: string) {
    const headingMap = [
      { key: "presentingComplaints", label: "Presenting Complaints" },
      { key: "clinicalFindings", label: "Clinical Findings" },
      { key: "assessmentAndAdvice", label: "Assessment & Advice" },
      { key: "medicinesPrescribed", label: "Medicines Prescribed" },
    ] as const;

    const sections: ConsultationProcessPayload["summarySections"] = {
      presentingComplaints: "",
      clinicalFindings: "",
      assessmentAndAdvice: "",
      medicinesPrescribed: "",
    };

    for (let index = 0; index < headingMap.length; index += 1) {
      const currentHeading = headingMap[index];
      const nextHeading = headingMap[index + 1];
      const currentPattern = new RegExp(`${currentHeading.label}\\s*[:\\n]\\s*`, "i");
      const currentMatch = currentPattern.exec(value);

      if (!currentMatch) {
        continue;
      }

      const startIndex = currentMatch.index + currentMatch[0].length;
      const endIndex = nextHeading
        ? (() => {
            const nextPattern = new RegExp(`\\n\\s*${nextHeading.label}\\s*[:\\n]`, "i");
            const sliced = value.slice(startIndex);
            const nextMatch = nextPattern.exec(sliced);
            return nextMatch ? startIndex + nextMatch.index : value.length;
          })()
        : value.length;

      sections[currentHeading.key] = value.slice(startIndex, endIndex).trim();
    }

    return sections;
  }

  private hasMeaningfulSections(summarySections: ConsultationProcessPayload["summarySections"]) {
    return Object.values(summarySections).some((value) => value.trim().length > 0);
  }

  private async extractPrescriptionFallback(
    transcript: string,
    medicinesPrescribedSection: string,
  ): Promise<ConsultationProcessPayload["prescriptions"]> {
    if (!this.client) {
      return [];
    }

    const prompt = `
You are extracting prescription drafts from an outpatient consultation.
Return ONLY valid JSON array. Do not add markdown fences or commentary.

Each item must use this exact shape:
[
  {
    "medicineName": "string",
    "dosage": "string",
    "frequency": "string",
    "timing": "string"
  }
]

Rules:
- include only medicines that were actually prescribed or clearly advised
- if no medicines are clearly prescribed, return []
- preserve dosage, frequency, and timing exactly when available

Medicines section:
${medicinesPrescribedSection || "Not available"}

Transcript:
${transcript}
    `.trim();

    try {
      const result = await this.generateContentWithFallback(prompt);
      const rawText = result.response.text().trim();
      const cleaned = this.stripMarkdownFences(rawText);
      const arrayCandidate = this.extractJsonArray(cleaned) ?? cleaned;
      const parsed = JSON.parse(arrayCandidate) as ConsultationProcessPayload["prescriptions"];
      return Array.isArray(parsed) ? parsed.filter((item) => item?.medicineName?.trim()) : [];
    } catch {
      return [];
    }
  }

  private parseConsultationResponse(
    rawText: string,
    transcript: string,
  ): Omit<ConsultationProcessPayload, "caseSummary"> & { caseSummary?: string } {
    const cleaned = this.stripMarkdownFences(rawText);
    const jsonCandidate = this.extractJsonObject(cleaned) ?? cleaned;

    try {
      return JSON.parse(jsonCandidate) as Omit<ConsultationProcessPayload, "caseSummary"> & {
        caseSummary?: string;
      };
    } catch {
      const summarySections = this.parseLabeledSections(cleaned);

      if (this.hasMeaningfulSections(summarySections)) {
        return {
          transcript,
          summarySections,
          sourceLanguages: ["English"],
          prescriptionNarrative: "",
          prescriptions: [],
          fourKeySummary: {},
        };
      }

      throw new Error("Unable to parse consultation response");
    }
  }

  private buildCaseSummary(summarySections: ConsultationProcessPayload["summarySections"]) {
    return [
      `Presenting Complaints\n${summarySections.presentingComplaints}`,
      `Clinical Findings\n${summarySections.clinicalFindings}`,
      `Assessment & Advice\n${summarySections.assessmentAndAdvice}`,
      `Medicines Prescribed\n${summarySections.medicinesPrescribed}`,
    ].join("\n\n");
  }

  buildFallbackSummary(transcript: string): ConsultationProcessPayload {
    const excerpt = transcript.trim().slice(0, 400) || "Consultation conversation available for review.";
    const summarySections = {
      presentingComplaints: "Patient complaints were captured during the consultation and should be reviewed from the generated transcript.",
      clinicalFindings: "Clinical findings could not be extracted reliably, so the transcript should be reviewed by the doctor.",
      assessmentAndAdvice: "A generalized consultation summary was generated because the detailed AI summary step did not complete successfully.",
      medicinesPrescribed: "Medicine extraction should be reviewed manually from the transcript and prescription section.",
    };

    return {
      transcript,
      caseSummary: this.buildCaseSummary(summarySections),
      summarySections,
      sourceLanguages: ["unknown"],
      prescriptionNarrative: `Fallback summary used. Transcript excerpt: ${excerpt}`,
      prescriptions: [],
      fourKeySummary: {},
    };
  }

  async transcribeConsultationAudio(audioBuffer: Buffer, mimeType: string) {
    if (!this.client) {
      throw new Error("GEMINI_API_KEY is required for audio transcription");
    }

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

    const result = await this.generateContentWithFallback([
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

    const result = await this.generateContentWithFallback(prompt);
    const rawText = result.response.text().trim();
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");

    return JSON.parse(cleaned) as ExtractedIntakePayload;
  }

  async processConsultationTranscript(transcript: string): Promise<ConsultationProcessPayload> {
    if (!this.client) {
      return this.buildFallbackSummary(transcript);
    }

    const structuredJsonPrompt = `
You are a medical OP consultation summarizer and prescription extractor.
You will receive an English transcript that was translated or normalized from the original consultation audio.

Important rules:
- keep the summary readable for doctors
- preserve medicine names, dosage instructions, symptoms, and clinically meaningful details
- hide uncertainty unless the ambiguity is clinically significant
- extract medicines spoken anywhere in the conversation
- return a read-only doctor-facing structured summary using these exact headings inside summarySections:
  1. Presenting Complaints
  2. Clinical Findings
  3. Assessment & Advice
  4. Medicines Prescribed
- every summarySections field must contain useful doctor-facing text
- if a section is not clearly available, write "Not clearly stated in transcript." instead of leaving it blank
- do not wrap the response in markdown fences
- do not add commentary before or after the JSON

Return ONLY valid JSON using this exact output format:
{
  "transcript": "<clean normalized transcript>",
  "summarySections": {
    "presentingComplaints": "<patient symptoms, duration, concerns>",
    "clinicalFindings": "<exam findings, relevant observations, known history>",
    "assessmentAndAdvice": "<doctor impression, advice, tests, follow-up>",
    "medicinesPrescribed": "<plain-language medicine summary>"
  },
  "sourceLanguages": ["English", "Telugu"],
  "prescriptionNarrative": "<short note about extracted medicines and dosing context>",
  "prescriptions": [
    {
      "medicineName": "<medicine name>",
      "dosage": "<dosage>",
      "frequency": "<frequency>",
      "timing": "<timing>"
    }
  ],
  "fourKeySummary": {
    "chronicConditions": "<chronic conditions or empty string>",
    "allergies": "<allergies or empty string>",
    "currentMedications": "<current medications or empty string>",
    "vitals": "<important vitals or empty string>"
  }
}

Example summarySections style:
{
  "presentingComplaints": "Fever for 3 days with cough and throat pain.",
  "clinicalFindings": "No acute respiratory distress mentioned. Prior diabetes history noted.",
  "assessmentAndAdvice": "Likely upper respiratory infection. Advised hydration, steam inhalation, and review if fever persists.",
  "medicinesPrescribed": "Paracetamol and cetirizine were advised."
}

Transcript:
${transcript}
    `.trim();

    const headingPrompt = `
You are a medical OP consultation summarizer.
You will receive an English transcript of a doctor-patient outpatient consultation.

Write a concise doctor-facing summary using ONLY these exact headings and plain text under each heading:
Presenting Complaints
Clinical Findings
Assessment & Advice
Medicines Prescribed

Rules:
- each heading must be present
- do not output JSON
- do not output markdown fences
- keep the wording concise and clinically useful
- if a heading is not clearly available, write "Not clearly stated in transcript."

Transcript:
${transcript}
    `.trim();

    const attemptSummary = async (prompt: string) => {
      const result = await this.generateContentWithFallback(prompt);
      const rawText = result.response.text().trim();
      return this.parseConsultationResponse(rawText, transcript);
    };

    try {
      const parsed = await attemptSummary(structuredJsonPrompt);
      let summarySections = parsed.summarySections ?? {
        presentingComplaints: "",
        clinicalFindings: "",
        assessmentAndAdvice: "",
        medicinesPrescribed: "",
      };

      if (!this.hasMeaningfulSections(summarySections) && parsed.caseSummary) {
        const parsedCaseSummarySections = this.parseLabeledSections(parsed.caseSummary);
        if (this.hasMeaningfulSections(parsedCaseSummarySections)) {
          summarySections = parsedCaseSummarySections;
        }
      }

      const parsedPrescriptions = parsed.prescriptions?.filter((item) => item?.medicineName?.trim()) ?? [];
      const prescriptions = parsedPrescriptions.length
        ? parsedPrescriptions
        : await this.extractPrescriptionFallback(transcript, summarySections.medicinesPrescribed);

      return {
        transcript: parsed.transcript || transcript,
        caseSummary: parsed.caseSummary || this.buildCaseSummary(summarySections),
        summarySections,
        sourceLanguages: parsed.sourceLanguages ?? ["English"],
        prescriptionNarrative: parsed.prescriptionNarrative ?? "",
        prescriptions,
        fourKeySummary: parsed.fourKeySummary ?? {},
      };
    } catch (firstError) {
      console.warn("Primary consultation summarization failed, retrying with heading format.", firstError);

      try {
        await this.wait(800);
        const parsed = await attemptSummary(headingPrompt);
        const summarySections = parsed.summarySections ?? {
          presentingComplaints: "",
          clinicalFindings: "",
          assessmentAndAdvice: "",
          medicinesPrescribed: "",
        };
        const prescriptions = await this.extractPrescriptionFallback(transcript, summarySections.medicinesPrescribed);

        return {
          transcript: parsed.transcript || transcript,
          caseSummary: this.buildCaseSummary(summarySections),
          summarySections,
          sourceLanguages: parsed.sourceLanguages ?? ["English"],
          prescriptionNarrative:
            parsed.prescriptionNarrative ||
            (prescriptions.length
              ? "Medicines were extracted from the consultation transcript."
              : "No clearly prescribed medicines were found in the consultation transcript."),
          prescriptions,
          fourKeySummary: parsed.fourKeySummary ?? {},
        };
      } catch (secondError) {
        console.warn("Consultation summarization fell back after both attempts failed.", secondError);
        return this.buildFallbackSummary(transcript);
      }
    }
  }

  async processConsultationAudio(audioBuffer: Buffer, mimeType: string) {
    const transcript = await this.transcribeConsultationAudio(audioBuffer, mimeType);
    return this.processConsultationTranscript(transcript);
  }
}

export const geminiService = new GeminiService();
