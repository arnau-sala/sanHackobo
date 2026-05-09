type ElevenLabsTtsOptions = {
  text: string;
  voiceId?: string;
  modelId?: string;
};

type ElevenLabsSttOptions = {
  audioBase64: string;
  mimeType?: string;
  modelId?: string;
  languageCode?: string;
};

type ElevenLabsTtsResult = {
  audioBase64: string;
  mimeType: string;
  provider: "elevenlabs";
  voiceId: string;
  modelId: string;
};

const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_STT_MODEL_ID = "scribe_v1";

export async function synthesizeWithElevenLabs(
  options: ElevenLabsTtsOptions,
): Promise<ElevenLabsTtsResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("Falta ELEVENLABS_API_KEY en variables de entorno");
  }

  const voiceId = options.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
  const modelId = options.modelId ?? process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_MODEL_ID;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: options.text,
        model_id: modelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
        },
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Error ElevenLabs TTS (${response.status}): ${details}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioBase64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    audioBase64,
    mimeType: "audio/mpeg",
    provider: "elevenlabs",
    voiceId,
    modelId,
  };
}

export async function transcribeWithElevenLabs(
  options: ElevenLabsSttOptions,
): Promise<{ transcript: string; modelId: string; provider: "elevenlabs" }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("Falta ELEVENLABS_API_KEY en variables de entorno");
  }

  const modelId = options.modelId ?? process.env.ELEVENLABS_STT_MODEL_ID ?? DEFAULT_STT_MODEL_ID;
  const mimeType = options.mimeType ?? "audio/webm";

  const audioBytes = Buffer.from(options.audioBase64, "base64");
  const form = new FormData();
  form.append("model_id", modelId);
  if (options.languageCode) {
    form.append("language_code", options.languageCode);
  }
  form.append("file", new Blob([audioBytes], { type: mimeType }), "voice-input.webm");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: form,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Error ElevenLabs STT (${response.status}): ${details}`);
  }

  const payload = (await response.json()) as { text?: string };
  const transcript = payload.text?.trim();
  if (!transcript) {
    throw new Error("ElevenLabs STT devolvio transcripcion vacia");
  }

  return {
    transcript,
    modelId,
    provider: "elevenlabs",
  };
}
