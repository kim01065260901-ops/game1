
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getGameFeedback(status: 'success' | 'failed', level: number, base64Image?: string) {
  const model = 'gemini-3-flash-preview';
  
  const prompt = status === 'success' 
    ? `The user successfully carved Level ${level} of the Dalgona game. Give a short, intense, and slightly dark congratulatory message in Korean (Squid Game style). Mention that the next level will be harder.`
    : `The user broke the Dalgona at Level ${level}. Give a short, intimidating, and dark message in Korean (Squid Game style) about their failure and elimination.`;

  const contents: any[] = [{ text: prompt }];
  
  if (base64Image) {
    contents.push({
      inlineData: {
        mimeType: 'image/png',
        data: base64Image.split(',')[1]
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: contents },
      config: {
        temperature: 1,
        maxOutputTokens: 200
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return status === 'success' ? `Level ${level}을 통과하셨군요. 하지만 다음은 쉽지 않을 겁니다.` : "탈락입니다. 당신의 번호는 이제 결번입니다.";
  }
}

export async function getIntroTip() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Give a short, mysterious survival tip for the Dalgona candy game in Korean (Squid Game style).",
      config: { temperature: 0.8 }
    });
    return response.text;
  } catch {
    return "침착하게, 가장자리를 공략하세요. 소란을 피우지 마십시오.";
  }
}
