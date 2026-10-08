const { GoogleGenAI, Type } = require("@google/genai");

const CATEGORIAS_PERMITIDAS = [
  "personal",
  "gustos",
  "familia",
  "amistades",
  "pasado",
  "sentimientos",
  "relaciones",
  "futuro",
  "metas",
  "preguntas-profundas",
  "divertidas",
  "atrevidas"
];

const INDICACIONES_CATEGORIA = {
  personal: "experiencias cotidianas, personalidad y aspectos personales no sensibles",
  gustos: "gustos, preferencias, pasatiempos y cosas que disfruta",
  familia: "recuerdos familiares agradables y vínculos familiares, sin presionar a revelar conflictos",
  amistades: "amistad, convivencia y cualidades que valora en sus amistades",
  pasado: "recuerdos y experiencias pasadas, sin solicitar detalles traumáticos o íntimos",
  sentimientos: "emociones, bienestar y formas respetuosas de expresar lo que siente",
  relaciones: "vínculos afectivos y lo que valora en una relación, sin asumir su situación sentimental",
  futuro: "ilusiones, planes e ideas sobre el futuro",
  metas: "objetivos, sueños y pasos que le gustaría dar para alcanzarlos",
  "preguntas-profundas": "reflexiones significativas sobre valores, aprendizajes y propósito, sin invadir su privacidad",
  divertidas: "situaciones graciosas, ideas creativas y escenarios ligeros y sorprendentes",
  atrevidas: "retos conversacionales pícaros y coquetos, siempre respetuosos, no explícitos y sin presión"
};

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

  let categoria = datos.categoria;
  if (categoria === undefined) {
    const categoriaAnterior = {
      divertido: "divertidas",
      personal: "personal",
      profundo: "preguntas-profundas"
    };
    categoria = datos.nivel === undefined
      ? "divertidas"
      : categoriaAnterior[datos.nivel] || datos.nivel;
  }
  if (typeof categoria !== "string" || !CATEGORIAS_PERMITIDAS.includes(categoria)) {
    return respuesta(400, { error: "Selecciona una categoría válida para la pregunta." });
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
        `Escribe exactamente una pregunta abierta en español natural para conocer mejor a una persona. Categoría: ${categoria}.`,
        `La pregunta debe tratar específicamente sobre: ${INDICACIONES_CATEGORIA[categoria]}.`,
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
    let pregunta = generado?.pregunta;
    if (typeof pregunta === "string") {
      pregunta = pregunta.trim();
      const inicioPregunta = pregunta.indexOf("¿");
      const finPregunta = pregunta.lastIndexOf("?");
      if (inicioPregunta >= 0 && finPregunta >= inicioPregunta) {
        pregunta = pregunta.slice(inicioPregunta, finPregunta + 1).trim();
      }
    }
    if (
      !generado ||
      typeof generado !== "object" ||
      Array.isArray(generado) ||
      Object.keys(generado).length !== 1 ||
      !validarPregunta(pregunta)
    ) {
      console.error("Gemini devolvió una pregunta con formato no válido.");
      throw new Error("Gemini no devolvió una sola pregunta válida.");
    }

    return respuesta(200, { pregunta });
  } catch (error) {
    const statusCode = Number(error && (error.status || error.statusCode));
    console.error("Error de Gemini:", {
      status: Number.isInteger(statusCode) ? statusCode : "desconocido",
      tipo: error && error.name
    });
    if (statusCode === 503) {
      return respuesta(503, {
        error: "Gemini está temporalmente ocupado. Intenta nuevamente en unos segundos."
      });
    }
    if (statusCode === 429) {
      return respuesta(429, {
        error: "Gemini alcanzó el límite temporal de solicitudes. Intenta nuevamente en unos segundos."
      });
    }

    return respuesta(502, { error: "No se pudo generar la pregunta. Intenta nuevamente." });
  }
};
