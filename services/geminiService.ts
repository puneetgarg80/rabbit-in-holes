import { GoogleGenAI } from "@google/genai";
import { HistoryEntry } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getGameHint = async (
  history: HistoryEntry[],
  holeCount: number
): Promise<string> => {
  const prompt = `
    You are a logic puzzle expert helping a player solve the "Quantum Fox in a Hole" puzzle.
    
    **Game Mechanics (Superposition):**
    1. There are ${holeCount} holes.
    2. The rabbit is NOT in a single hole. It exists in a "superposition" of ALL possible holes consistent with the history of checks.
    3. Initially (Day 1), the rabbit could be in ANY hole.
    4. Each day, the player checks one hole. 
       - If it's the ONLY possible location left, the player WINS.
       - Otherwise, that hole is removed from the possibilities for the current day.
    5. AFTER the check, all remaining possible rabbits move to adjacent holes (left or right).
    6. The goal is to reduce the set of "Possible Holes" until size 1.
    
    **Current Status:**
    - Day: ${history.length + 1}
    - History: ${history.length === 0 ? "None" : history.map(h => `Day ${h.day}: Checked ${h.checkedHoleIndex + 1} (${h.remainingPossibilitiesCount} possibilities remained)`).join(', ')}
    
    **Task:**
    Analyze the current day.
    Suggest a move that efficiently reduces the number of possible rabbit locations.
    Explain WHY based on the "set reduction" logic.
    For 5 holes, the optimal sequence is often 2, 3, 4, 2, 3, 4.
    Keep it short, friendly, and helpful.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful game assistant. Keep hints short (under 100 words). Focus on the 'possible locations' logic.",
      }
    });

    return response.text || "The Wise Owl is silent. Trust your logic!";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I couldn't reach the Wise Owl (Network Error).";
  }
};