const { GoogleGenAI, Type } = require("@google/genai");

const NIVELES_PERMITIDOS = ["divertido", "personal", "profundo"];

function respuesta(statusCode, contenido) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(contenido)
  };
}

function validarPregunta(pregunta) {
  return (
    typeof pregunta === "string" &&
    pregunta.length >= 10 &&
    pregunta.length <= 300 &&
    pregunta.startsWith("¿") &&
    pregunta.endsWith("?") &&
    !/[\r\n]/.test(pregunta) &&
    (pregunta.match(/\?/g) || []).length === 1 &&
    (pregunta.match(/¿/g) || []).length === 1
  );
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return respuesta(405, { error: "Método no permitido." });
  }

  let datos;
  try {
    const cuerpo = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : event.body;
    datos = JSON.parse(cuerpo || "{}");
  } catch (error) {
    return respuesta(400, { error: "El cuerpo debe ser un JSON válido." });
  }

  if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
    return respuesta(400, { error: "La solicitud no es válida." });
  }

  const nivel = datos.nivel === undefined ? "divertido" : datos.nivel;
  if (typeof nivel !== "string" || !NIVELES_PERMITIDOS.includes(nivel)) {
    return respuesta(400, { error: "El nivel debe ser divertido, personal o profundo." });
  }

  // AQUÍ VA EL API en el archivo .env de la raíz del proyecto (no pegues la clave en este archivo):
  // GEMINI_API_KEY=PEGA_AQUI_TU_API
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY no está configurada.");
    return respuesta(500, { error: "El servicio de preguntas no está configurado." });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const resultado = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        `Escribe exactamente una pregunta abierta en español natural para conocer mejor a una persona. Nivel: ${nivel}.`,
        "La pregunta debe ser respetuosa, apta para una conversación y terminar con signo de interrogación.",
        "No solicites contraseñas, direcciones, datos bancarios, documentos ni información privada delicada.",
        "Evita contenido discriminatorio, ofensivo o peligroso.",
        "Devuelve solo un objeto JSON con la propiedad pregunta. No incluyas respuestas, opciones, explicaciones ni listas."
      ].join(" "),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { pregunta: { type: Type.STRING } },
          required: ["pregunta"]
        },
        maxOutputTokens: 1024
      }
    });

    const salida = resultado.text;
    if (typeof salida !== "string") {
      throw new Error("La respuesta de Gemini no contiene texto.");
    }

    const generado = JSON.parse(salida);
    if (
      !generado ||
      typeof generado !== "object" ||
      Array.isArray(generado) ||
      Object.keys(generado).length !== 1 ||
      !validarPregunta(generado.pregunta)
    ) {
      throw new Error("Gemini no devolvió una sola pregunta válida.");
    }

    return respuesta(200, { pregunta: generado.pregunta });
  } catch (error) {
    const statusCode = Number(error && error.status);
    console.error("Error de Gemini (HTTP):", Number.isInteger(statusCode) ? statusCode : "desconocido");
    if (statusCode === 503) {
      return respuesta(503, {
        error: "Gemini está temporalmente ocupado. Intenta nuevamente en unos segundos."
      });
    }

    return respuesta(502, { error: "No se pudo generar la pregunta. Intenta nuevamente." });
  }
};
