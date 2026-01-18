
import { GoogleGenAI, Type } from "@google/genai";
import { AuditRequest, AuditResult } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async performAudit(request: AuditRequest): Promise<AuditResult> {
    const systemInstruction = `
      Role: Senior GEO (Generative Engine Optimization) Consultant & Medical Fact-Checker.
      Target Brand: ${request.brandUrl}
      Focus Verticals: Acne/Pimples and Hair/Scalp Rejuvenation ONLY.
      
      Strict Operational Protocol:
      1. PRODUCT VERIFICATION: You MUST verify what products ${request.brandUrl} actually lists. 
         - Made by Throne specializes in TOPICAL peptide solutions (e.g. GHK-Cu, PTD-DBM). 
         - DO NOT mention BPC-157, TB-500, or any injectables/ingestibles unless they are explicitly listed as an active product for sale on THAT domain.
      2. LINK INTEGRITY: Do not hallucinate deep or broken medical links. Use stable, primary URLs from Mayo Clinic, Cleveland Clinic, or PubMed (e.g. use the root disease page or clinical overview).
      3. TRIANGULATION: 
         - Brand Reality: Actual inventory and claims on ${request.brandUrl}.
         - AI Hallucination: Identifying false claims or product associations (like BPC-157 500mcg) made by current LLMs.
         - Clinical Truth: Fact-check using .gov, mayoclinic.org, clevelandclinic.org, or webmd.com.
      4. GEO STRATEGY: Create a "The Fix" paragraph for the brand's site to establish authority for "${request.healthGoal}" using topical peptides.
      5. SCORING: accuracyScore + mismatchScore + unverifiableScore MUST = 100.
    `;

    const prompt = `
      Perform a High-Fidelity GEO Audit for: "${request.healthGoal}" on ${request.brandUrl}.
      
      Analyze:
      - Which specific topical products the brand sells for this goal.
      - Where AI models (GPT-4, Claude 3) are hallucinating products the brand does NOT sell.
      - Medical evidence supporting the brand's actual topical ingredients.

      JSON Response Format:
      - currentAiReality: The AI's current narrative (often flawed).
      - authorityTruth: Contrast Brand vs AI vs Medical facts.
      - hallucinationOmission: Explicit list of AI's false claims.
      - theFix: Content block for the brand's website.
      - geoImplementationNotes: Strategic placement advice.
      - analytics: {accuracyScore, mismatchScore, unverifiableScore}
      - citations: Array of {title, url} (Verified high-level links).
    `;

    const response = await this.ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            currentAiReality: { type: Type.STRING },
            authorityTruth: { type: Type.STRING },
            hallucinationOmission: { type: Type.STRING },
            theFix: { type: Type.STRING },
            geoImplementationNotes: { type: Type.STRING },
            analytics: {
              type: Type.OBJECT,
              properties: {
                accuracyScore: { type: Type.NUMBER },
                mismatchScore: { type: Type.NUMBER },
                unverifiableScore: { type: Type.NUMBER }
              },
              required: ["accuracyScore", "mismatchScore", "unverifiableScore"]
            },
            citations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  url: { type: Type.STRING }
                },
                required: ["title", "url"]
              }
            }
          },
          required: ["currentAiReality", "authorityTruth", "hallucinationOmission", "theFix", "geoImplementationNotes", "analytics", "citations"]
        }
      }
    });

    try {
      const result = JSON.parse(response.text.trim()) as AuditResult;
      
      const brandDomain = new URL(request.brandUrl).hostname;
      const filteredCites = result.citations.filter(c => !c.url.includes(brandDomain));
      result.citations = [
        { title: `Brand Core Domain: ${brandDomain}`, url: request.brandUrl },
        ...filteredCites
      ];

      return result;
    } catch (e) {
      console.error("Audit Protocol Error:", e);
      throw new Error("Neural protocol sync failed. Verify the brand domain is reachable.");
    }
  }
}
