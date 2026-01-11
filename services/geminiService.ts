import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const diagnoseProblem = async (userDescription: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Tu es un expert mécanicien virtuel pour l'application "Dépanni" au Maroc.
      L'utilisateur a un problème avec sa voiture.
      Description de l'utilisateur: "${userDescription}".
      
      Analyse le problème et donne une réponse TRÈS courte (max 2 phrases) pour suggérer la cause probable.
      Sois rassurant. Parle en Français.`,
      config: {
        maxOutputTokens: 100,
        temperature: 0.7,
      }
    });

    return response.text || "Désolé, je n'ai pas pu analyser le problème. Contactez un mécanicien.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Diagnostic indisponible pour le moment.";
  }
};