
import { GoogleGenAI } from "@google/genai";

// 브라우저 환경에서 process.env가 없을 경우를 대비한 안전한 접근
const getApiKey = () => {
  try {
    return (globalThis as any).process?.env?.API_KEY || "";
  } catch {
    return "";
  }
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export async function getGameFeedback(status: 'success' | 'failed', level: number, base64Image?: string) {
  const model = 'gemini-3-flash-preview';
  const prompt = status === 'success' 
    ? `사용자가 달고나 게임 ${level}단계를 통과했습니다. 짧고 강렬하며 약간 어두운 축하 메시지를 한국어로 작성하세요 (오징어 게임 스타일). 다음 단계가 더 어려울 것임을 암시하세요.`
    : `사용자가 ${level}단계에서 달고나를 깨뜨렸습니다. 실패와 탈락에 대한 위협적이고 어두운 메시지를 한국어로 작성하세요 (오징어 게임 스타일).`;

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
      config: { temperature: 1, maxOutputTokens: 200 }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return status === 'success' ? `통과하셨군요. 하지만 운이 좋았던 걸지도 모릅니다.` : "탈락입니다. 게임은 여기서 끝입니다.";
  }
}

export async function getIntroTip() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "달고나 게임에 대한 짧고 신비로운 생존 팁을 한국어로 작성하세요 (오징어 게임 스타일).",
      config: { temperature: 0.8 }
    });
    return response.text;
  } catch {
    return "바늘 끝에 집중하십시오. 미세한 균열이 당신의 생사를 결정할 것입니다.";
  }
}
