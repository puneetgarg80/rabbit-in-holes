import { GoogleGenAI } from "@google/genai";
import { HistoryEntry } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getGameHint = async (
  history: HistoryEntry[],
  holeCount: number
): Promise<string> => {
  const prompt = `
    You are a logic puzzle expert helping a player solve the "Fox in a Hole" (or Rabbit in a Hole) puzzle.
    
    **Rules:**
    1. There are ${holeCount} holes arranged in a line (indexed 1 to ${holeCount}).
    2. Every morning, the player (Fox) inspects one hole.
    3. If the rabbit is there, the player wins.
    4. If not, the rabbit *must* move to an adjacent hole (left or right) for the next day.
    5. The rabbit cannot stay in the same hole.
    
    **Current Game State:**
    The player is on Day ${history.length + 1}.
    
    **History of Checks:**
    ${history.length === 0 ? "No checks made yet." : history.map(h => `- Day ${h.day}: Checked Hole ${h.checkedHoleIndex + 1} (Empty)`).join('\n')}
    
    **Your Task:**
    Analyze the history and explain the logic to the user.
    Suggest which hole to check next to follow the optimal deterministic strategy (often called the checking sequence) to guarantee catching the rabbit.
    If you are unsure, provide a probabilistic suggestion.
    Keep the explanation concise, encouraging, and easy to understand for a mobile user.
    Do not use markdown formatting like bolding too aggressively, keep it clean.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Fast and smart enough for this logic
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful game assistant. Keep hints short (under 100 words).",
        // Thinking config can be used for more complex analysis, but flash is good here.
        // We'll trust flash's logic capabilities for this well-known puzzle.
      }
    });

    return response.text || "The Wise Owl is silent right now. Try relying on your instincts!";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I couldn't reach the Wise Owl (Network Error). Check your connection or API key.";
  }
};
