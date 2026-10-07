const SUPABASE_URL =
  "https://mixxpgweniwicrysjhwx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_Todhd1IpFgO6PoD6H4IyTA_K43HgEyk";
const supabaseClient =
  SUPABASE_PUBLISHABLE_KEY !== "PEGA_AQUI_LA_NUEVA_PUBLISHABLE_KEY" &&
  window.supabase &&
  typeof window.supabase.createClient === "function"
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
    : null;

const pantallas = document.querySelectorAll(".pantalla");
const nombreJugadorInput = document.getElementById("nombreJugador");
const codigoSalaInput = document.getElementById("codigoSala");
const mensajeInicio = document.getElementById("mensajeInicio");
const botonComenzar = document.getElementById("botonComenzar");
const PROBABILIDAD_SHOT = 0.25;

let nombreJugador = "";
let codigoSala = "";
let canalSala = null;
let conectadoASala = false;
let esAnfitrion = false;
let ruletaOcupada = false;
let jugadores = [];
let clavePresencia = "";
let ronda = 1;
let jugadorSeleccionado = "";
let shotActual = false;
const nivelesPregunta = ["divertido", "personal", "profundo"];

function cambiarPantalla(idPantalla) {
  pantallas.forEach((pantalla) => {
    pantalla.classList.toggle("activa", pantalla.id === idPantalla);
  });
}

function limpiarTexto(texto) {
  return texto.trim().replace(/\s+/g, " ");
}

function mostrarMensajeInicio(mensaje) {
  mensajeInicio.textContent = mensaje;
}

function validarNombre() {
  const nombre = limpiarTexto(nombreJugadorInput.value);

  if (nombre.length < 2 || nombre.length > 20) {
    mostrarMensajeInicio("Escribe un nombre de entre 2 y 20 caracteres.");
    nombreJugadorInput.focus();
    return false;
  }

  nombreJugador = nombre;
  mostrarMensajeInicio("");
  return true;
}

function generarCodigoSala() {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => (
    caracteres[Math.floor(Math.random() * caracteres.length)]
  )).join("");
}

function escaparHTML(texto) {
  const entidades = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  };

  return String(texto).replace(/[&<>"']/g, (caracter) => entidades[caracter]);
}

function obtenerJugadoresConectados() {
  if (!canalSala) {
    return [];
  }

  const estado = canalSala.presenceState();
  return Object.entries(estado).flatMap(([clave, presencias]) =>
    presencias
      .filter((presencia) => presencia.conectado === true && typeof presencia.nombre === "string")
      .map((presencia) => ({
        clave,
        nombre: presencia.nombre,
        anfitrion: presencia.anfitrion === true,
        unidoEn: Number(presencia.unidoEn) || 0
      }))
  );
}

function actualizarListaJugadores(jugadoresConectados = obtenerJugadoresConectados()) {
  jugadores = jugadoresConectados.slice(0, 4);
  const lista = document.getElementById("listaJugadores");
  lista.replaceChildren();

  jugadores.forEach((jugador) => {
    const elemento = document.createElement("li");
    const indicador = document.createElement("span");
    const nombre = document.createElement("span");
    const estado = document.createElement("span");

    elemento.className = jugador.clave === clavePresencia ? "jugador local" : "jugador";
    indicador.className = "punto";
    indicador.setAttribute("aria-hidden", "true");
    nombre.className = "nombreJugadorSala";
    nombre.textContent =
      jugador.clave === clavePresencia ? `${jugador.nombre} (tú)` : jugador.nombre;
    estado.className = "estadoConectado";
    estado.textContent = "Conectado";
    elemento.append(indicador, nombre, estado);
    lista.append(elemento);
  });

  document.getElementById("contadorJugadores").textContent = `${jugadores.length}/4`;
  document.getElementById("estadoSala").textContent =
    `${jugadores.length} de 4 jugadores conectados${esAnfitrion ? " · Eres anfitrión" : ""}.`;
}

function obtenerContenedorChat() {
  const pantallaActiva = document.querySelector(".pantalla.activa");
  if (!pantallaActiva) {
    return null;
  }

  if (pantallaActiva.id === "pantallaSala") {
    return document.getElementById("mensajesChat");
  }

  if (pantallaActiva.id === "pantallaJuego") {
    return document.getElementById("mensajesChatJuego");
  }

  return null;
}

function mostrarMensajeChat(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.nombre !== "string" ||
    typeof payload.mensaje !== "string"
  ) {
    console.error("Se recibió un mensaje de chat no válido.");
    return;
  }

  const nombre = limpiarTexto(payload.nombre);
  const texto = limpiarTexto(payload.mensaje);
  if (nombre.length < 2 || nombre.length > 20 || !texto || texto.length > 200) {
    console.error("Se recibió un mensaje de chat con datos no válidos.");
    return;
  }

  const contenedor = obtenerContenedorChat();
  if (!contenedor) {
    return;
  }

  const mensajeSistema = contenedor.querySelector(".mensajeSistema");
  if (mensajeSistema) {
    mensajeSistema.remove();
  }

  const elemento = document.createElement("p");
  const autor = document.createElement("strong");
  const textoMensaje = document.createElement("span");
  elemento.className = "mensajeChat";
  autor.textContent = `${nombre}: `;
  textoMensaje.textContent = texto;
  elemento.append(autor, textoMensaje);
  contenedor.append(elemento);
  contenedor.scrollTop = contenedor.scrollHeight;
}

async function enviarMensajeChat(idEntrada) {
  const entrada = document.getElementById(idEntrada);
  const estado = entrada.closest(".chat").querySelector(".mensajeEstadoChat");
  const texto = limpiarTexto(entrada.value);

  if (!canalSala || !conectadoASala || !nombreJugador) {
    estado.textContent = "No estás conectado a una sala.";
    return;
  }

  if (!texto) {
    return;
  }

  if (texto.length > 200) {
    estado.textContent = "El mensaje no puede superar los 200 caracteres.";
    return;
  }

  const payload = {
    nombre: nombreJugador,
    mensaje: texto,
    hora: new Date().toISOString()
  };

  try {
    const resultado = await canalSala.send({
      type: "broadcast",
      event: "mensaje-chat",
      payload
    });
    if (resultado !== "ok") {
      throw new Error(`El canal respondió con estado ${resultado}.`);
    }

    estado.textContent = "";
    entrada.value = "";
    entrada.focus();
    mostrarMensajeChat(payload);
  } catch (error) {
    console.error("Error al enviar mensaje:", error);
    estado.textContent = "No se pudo enviar el mensaje.";
  }
}

function prepararEntradaChat(idFormulario, idEntrada, idBoton) {
  const formulario = document.getElementById(idFormulario);
  const entrada = document.getElementById(idEntrada);

  formulario.addEventListener("submit", (evento) => evento.preventDefault());
  document.getElementById(idBoton).addEventListener("click", () => {
    void enviarMensajeChat(idEntrada);
  });
  entrada.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter") {
      evento.preventDefault();
      void enviarMensajeChat(idEntrada);
    }
  });
}

function limpiarChatsTemporales() {
  const salasChat = [
    ["mensajesChat", "Los mensajes aparecerán aquí."],
    ["mensajesChatJuego", "Conversación de la partida."]
  ];

  salasChat.forEach(([id, mensajeInicial]) => {
    const contenedor = document.getElementById(id);
    const mensajeSistema = document.createElement("p");
    mensajeSistema.className = "mensajeSistema";
    mensajeSistema.textContent = mensajeInicial;
    contenedor.replaceChildren(mensajeSistema);
  });

  document.getElementById("mensajesChatSala").replaceChildren();
  document.getElementById("textoChat").value = "";
  document.getElementById("textoChatJuego").value = "";
  document.querySelectorAll(".mensajeEstadoChat").forEach((elemento) => {
    elemento.textContent = "";
  });
}

function manejarCambioPresence(canalActual) {
  if (canalSala !== canalActual) {
    return;
  }

  const conectados = obtenerJugadoresConectados();
  actualizarListaJugadores(conectados);

  if (conectados.length <= 4) {
    return;
  }

  // Todos los clientes ordenan la admisión igual para resolver entradas simultáneas.
  const ordenAdmisiones = [...conectados].sort((a, b) =>
    a.unidoEn - b.unidoEn || a.clave.localeCompare(b.clave)
  );
  const posicionLocal = ordenAdmisiones.findIndex((jugador) => jugador.clave === clavePresencia);
  if (posicionLocal >= 4) {
    void desconectarseDeSala("La sala ya está llena.");
  }
}

function mostrarErrorDeConexion(canalActual, mensaje) {
  if (canalSala !== canalActual) {
    return;
  }

  console.error(mensaje);
  void desconectarseDeSala(mensaje);
}

async function conectarseASala() {
  if (!supabaseClient) {
    throw new Error(
      "Falta configurar Project URL y Publishable key, o no se pudo cargar el CDN de Supabase."
    );
  }

  clavePresencia = window.crypto && typeof window.crypto.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const canalActual = supabaseClient.channel(`ruleta-${codigoSala}`, {
    config: { presence: { key: clavePresencia } }
  });
  canalSala = canalActual;
  conectadoASala = false;

  canalActual
    .on("presence", { event: "sync" }, () => manejarCambioPresence(canalActual))
    .on("presence", { event: "join" }, () => manejarCambioPresence(canalActual))
    .on("presence", { event: "leave" }, () => manejarCambioPresence(canalActual))
    .on("broadcast", { event: "jugador-seleccionado" }, ({ payload }) => {
      mostrarJugadorSeleccionado(payload);
    })
    .on("broadcast", { event: "partida-iniciada" }, () => {
      iniciarPantallaJuego();
    })
    .on("broadcast", { event: "pregunta-generada" }, ({ payload }) => {
      if (
        !payload ||
        typeof payload.jugador !== "string" ||
        typeof payload.pregunta !== "string"
      ) {
        console.error("Se recibió un evento de pregunta no válido.");
        return;
      }

      mostrarPreguntaAbierta(payload.jugador, payload.pregunta);
    })
    .on("broadcast", { event: "pregunta-error" }, ({ payload }) => {
      if (!payload || typeof payload.jugador !== "string") {
        console.error("Se recibió un evento de error de pregunta no válido.");
        return;
      }

      const nombre = limpiarTexto(payload.jugador);
      if (nombre !== jugadorSeleccionado) {
        return;
      }

      const mensajeError =
        payload.mensaje === "Gemini está temporalmente ocupado. Intenta nuevamente en unos segundos."
          ? payload.mensaje
          : "No se pudo generar la pregunta. Intenta nuevamente.";
      document.getElementById("estadoPregunta").textContent = mensajeError;
    })
    .on("broadcast", { event: "mensaje-chat" }, ({ payload }) => {
      mostrarMensajeChat(payload);
    });

  return new Promise((resolve, reject) => {
    let registroIniciado = false;

    canalActual.subscribe(async (estado) => {
      if (canalSala !== canalActual) {
        resolve(false);
        return;
      }

      if (estado === "SUBSCRIBED" && !registroIniciado) {
        registroIniciado = true;
        const conectados = obtenerJugadoresConectados();

        if (conectados.length >= 4) {
          await desconectarseDeSala("La sala ya está llena.");
          resolve(false);
          return;
        }

        try {
          const resultado = await canalActual.track({
            nombre: nombreJugador,
            conectado: true,
            anfitrion: esAnfitrion,
            unidoEn: Date.now()
          });

          if (resultado !== "ok") {
            throw new Error(`No se pudo registrar Presence (estado: ${resultado}).`);
          }

          if (canalSala !== canalActual) {
            resolve(false);
            return;
          }

          conectadoASala = true;
          manejarCambioPresence(canalActual);
          resolve(true);
        } catch (error) {
          mostrarErrorDeConexion(canalActual, `No se pudo registrar el jugador: ${error.message}`);
          reject(error);
        }
        return;
      }

      if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT" || estado === "CLOSED") {
        const error = new Error(`La conexión Realtime terminó con estado ${estado}.`);
        mostrarErrorDeConexion(canalActual, error.message);
        reject(error);
      }
    });
  });
}

async function entrarALaSala() {
  document.getElementById("codigoSalaMostrar").textContent = codigoSala;
  document.getElementById("codigoSalaJuego").textContent = codigoSala;
  document.getElementById("estadoSala").textContent = "Conectando con la sala...";
  limpiarChatsTemporales();
  document.getElementById("listaJugadores").replaceChildren();
  document.getElementById("contadorJugadores").textContent = "0/4";
  document.getElementById("botonComenzar").disabled = true;
  cambiarPantalla("pantallaSala");

  try {
    const conectado = await conectarseASala();
    if (conectado) {
      botonComenzar.disabled = !esAnfitrion;
    }
  } catch (error) {
    mostrarMensajeInicio(error.message);
    if (!canalSala) {
      cambiarPantalla("pantallaInicio");
    }
  }
}

async function desconectarseDeSala(mensaje = "") {
  const canalActual = canalSala;
  const errores = [];
  canalSala = null;
  conectadoASala = false;

  if (canalActual) {
    try {
      const estadoUntrack = await canalActual.untrack();
      if (estadoUntrack !== "ok" && estadoUntrack !== "timed out") {
        errores.push(`untrack: ${estadoUntrack}`);
      }
    } catch (error) {
      console.error("Error al quitar Presence:", error);
      errores.push(`untrack: ${error.message}`);
    }

    try {
      const estadoUnsubscribe = await canalActual.unsubscribe();
      if (estadoUnsubscribe !== "ok" && estadoUnsubscribe !== "timed out") {
        errores.push(`unsubscribe: ${estadoUnsubscribe}`);
      }
    } catch (error) {
      console.error("Error al desuscribir el canal:", error);
      errores.push(`unsubscribe: ${error.message}`);
    }

    try {
      const estadoEliminacion = await supabaseClient.removeChannel(canalActual);
      if (estadoEliminacion !== "ok" && estadoEliminacion !== "timed out") {
        errores.push(`removeChannel: ${estadoEliminacion}`);
      }
    } catch (error) {
      console.error("Error al eliminar el canal:", error);
      errores.push(`removeChannel: ${error.message}`);
    }
  }

  codigoSala = "";
  nombreJugador = "";
  esAnfitrion = false;
  clavePresencia = "";
  jugadores = [];
  ronda = 1;
  shotActual = false;
  ruletaOcupada = false;
  nombreJugadorInput.value = "";
  codigoSalaInput.value = "";
  document.getElementById("listaJugadores").replaceChildren();
  document.getElementById("contadorJugadores").textContent = "0/4";
  document.getElementById("botonComenzar").disabled = false;
  limpiarChatsTemporales();
  cambiarPantalla("pantallaInicio");

  const avisos = [mensaje, errores.length ? `Error al limpiar conexión (${errores.join(", ")}).` : ""]
    .filter(Boolean)
    .join(" ");
  if (avisos) {
    mostrarMensajeInicio(avisos);
  }
}

function iniciarPantallaJuego() {
  ronda = 1;
  document.getElementById("rondaActual").textContent = `Ronda ${ronda}`;
  document.getElementById("tarjetaPregunta").classList.add("oculto");
  document.getElementById("botonGirar").disabled = !esAnfitrion;
  cambiarPantalla("pantallaJuego");
}

async function iniciarPartida() {
  if (!esAnfitrion || !canalSala) {
    return;
  }

  botonComenzar.disabled = true;
  try {
    const resultado = await canalSala.send({
      type: "broadcast",
      event: "partida-iniciada",
      payload: {}
    });
    if (resultado !== "ok") {
      throw new Error(`No se pudo iniciar la partida (estado: ${resultado}).`);
    }

    iniciarPantallaJuego();
  } catch (error) {
    console.error("No se pudo iniciar la partida:", error);
    document.getElementById("estadoSala").textContent =
      `No se pudo iniciar la partida: ${error.message}`;
    botonComenzar.disabled = false;
  }
}

function mostrarJugadorSeleccionado(payload) {
  if (!payload || typeof payload.jugador !== "string") {
    console.error("Se recibió un resultado de ruleta no válido.");
    return;
  }

  const nombre = limpiarTexto(payload.jugador);
  if (nombre.length < 2 || nombre.length > 20) {
    console.error("Se recibió un nombre no válido en el resultado de ruleta.");
    return;
  }

  jugadorSeleccionado = nombre;
  shotActual = payload.shot === true;
  const ruleta = document.getElementById("ruleta");
  const resultadoShot = document.getElementById("resultadoShot");
  resultadoShot.textContent = shotActual ? "¡SHOT! 🥃" : "";
  ruleta.classList.remove("shot-activo");
  if (shotActual) {
    void ruleta.offsetWidth;
    ruleta.classList.add("shot-activo");
  }
  document.getElementById("jugadorTurno").textContent =
    `¡Le toca a ${nombre}!${shotActual ? "\n¡Te toca shot! 🥃" : ""}`;
  document.getElementById("estadoPregunta").textContent = "Generando pregunta...";
  document.getElementById("tarjetaPregunta").classList.add("oculto");
}

function mostrarPreguntaAbierta(nombreJugadorSeleccionado, pregunta) {
  if (
    typeof nombreJugadorSeleccionado !== "string" ||
    typeof pregunta !== "string"
  ) {
    console.error("Se recibió una pregunta generada no válida.");
    return false;
  }

  const nombre = limpiarTexto(nombreJugadorSeleccionado);
  const texto = pregunta.trim();
  if (
    nombre.length < 2 ||
    nombre.length > 20 ||
    texto.length < 10 ||
    texto.length > 300 ||
    !texto.startsWith("¿") ||
    !texto.endsWith("?") ||
    (texto.match(/\?/g) || []).length !== 1 ||
    (texto.match(/¿/g) || []).length !== 1
  ) {
    console.error("La pregunta recibida no cumple el formato requerido.");
    return false;
  }

  jugadorSeleccionado = nombre;
  document.getElementById("jugadorTurno").textContent =
    `¡Le toca a ${nombre}!${shotActual ? "\n¡Te toca shot! 🥃" : ""}`;
  document.getElementById("jugadorPregunta").textContent = nombre;
  document.getElementById("textoPregunta").textContent = texto;
  document.getElementById("mensajeRespuesta").textContent =
    "Responde en el chat para que todos puedan participar.";
  document.getElementById("estadoPregunta").textContent = "";
  document.getElementById("tarjetaPregunta").classList.remove("oculto");
  return true;
}

async function generarPreguntaConIA(nivel = "divertido") {
  const nivelValido = nivelesPregunta.includes(nivel) ? nivel : "divertido";
  const respuesta = await fetch("/.netlify/functions/generar-pregunta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nivel: nivelValido })
  });

  let datos;
  try {
    datos = await respuesta.json();
  } catch (error) {
    throw new Error("La función de preguntas devolvió una respuesta no válida.");
  }

  if (!respuesta.ok) {
    throw new Error(
      typeof datos.error === "string"
        ? datos.error
        : "No se pudo generar la pregunta."
    );
  }

  if (typeof datos.pregunta !== "string") {
    throw new Error("La respuesta no contiene una pregunta válida.");
  }

  const pregunta = datos.pregunta.trim();
  if (
    pregunta.length < 10 ||
    pregunta.length > 300 ||
    !pregunta.startsWith("¿") ||
    !pregunta.endsWith("?") ||
    (pregunta.match(/\?/g) || []).length !== 1 ||
    (pregunta.match(/¿/g) || []).length !== 1
  ) {
    throw new Error("La respuesta no contiene una sola pregunta abierta.");
  }

  return pregunta;
}

async function girarRuleta() {
  if (!esAnfitrion || !canalSala || ruletaOcupada) {
    return;
  }

  const nombresJugadores = obtenerJugadoresConectados()
    .map((jugador) => jugador.nombre.trim())
    .filter((nombre) => (
      nombre.length > 0 &&
      !["undefined", "null", "esperando jugadores", "jugador seleccionado"]
        .includes(nombre.toLocaleLowerCase())
    ));
  const tarjetaPregunta = document.getElementById("tarjetaPregunta");
  const botonGirar = document.getElementById("botonGirar");

  if (nombresJugadores.length === 0) {
    tarjetaPregunta.classList.add("oculto");
    document.getElementById("estadoPregunta").textContent = "";
    document.getElementById("jugadorTurno").textContent = "No hay participantes disponibles.";
    return;
  }

  const ruleta = document.getElementById("ruleta");
  ruletaOcupada = true;
  botonGirar.disabled = true;
  tarjetaPregunta.classList.add("oculto");
  document.getElementById("estadoPregunta").textContent = "";
  ruleta.classList.remove("girando");
  void ruleta.offsetWidth;
  ruleta.classList.add("girando");

  try {
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    ruleta.classList.remove("girando");
    const nombre = nombresJugadores[Math.floor(Math.random() * nombresJugadores.length)];
    const shot = Math.random() < PROBABILIDAD_SHOT;
    const resultado = await canalSala.send({
      type: "broadcast",
      event: "jugador-seleccionado",
      payload: { jugador: nombre, shot }
    });
    if (resultado !== "ok") {
      throw new Error(`No se pudo compartir el resultado (estado: ${resultado}).`);
    }
    mostrarJugadorSeleccionado({ jugador: nombre, shot });

    const pregunta = await generarPreguntaConIA(
      document.getElementById("nivelPregunta").value
    );
    const resultadoPregunta = await canalSala.send({
      type: "broadcast",
      event: "pregunta-generada",
      payload: { jugador: nombre, pregunta }
    });
    if (resultadoPregunta !== "ok") {
      throw new Error(`No se pudo compartir la pregunta (estado: ${resultadoPregunta}).`);
    }

    mostrarPreguntaAbierta(nombre, pregunta);
  } catch (error) {
    console.error("Error al generar o compartir la pregunta:", error);
    const mensajeError =
      error.message === "Gemini está temporalmente ocupado. Intenta nuevamente en unos segundos."
        ? error.message
        : "No se pudo generar la pregunta. Intenta nuevamente.";
    document.getElementById("estadoPregunta").textContent = mensajeError;
    try {
      if (canalSala && jugadorSeleccionado) {
        await canalSala.send({
          type: "broadcast",
          event: "pregunta-error",
          payload: { jugador: jugadorSeleccionado, mensaje: mensajeError }
        });
      }
    } catch (errorBroadcast) {
      console.error("No se pudo compartir el error de generación:", errorBroadcast);
    }
  } finally {
    ruleta.classList.remove("girando");
    ruletaOcupada = false;
    botonGirar.disabled = !esAnfitrion;
  }
}

function terminarJuego() {
  void desconectarseDeSala();
  mostrarMensajeInicio("");
}

document.getElementById("botonCrearSala").addEventListener("click", () => {
  if (!validarNombre()) {
    return;
  }

  if (!supabaseClient) {
    mostrarMensajeInicio(
      "Configura Project URL y Publishable key en app.js y verifica que cargue el CDN de Supabase."
    );
    return;
  }

  codigoSala = generarCodigoSala();
  esAnfitrion = true;
  void entrarALaSala();
});

document.getElementById("botonUnirseSala").addEventListener("click", () => {
  if (!validarNombre()) {
    return;
  }

  const codigoEscrito = limpiarTexto(codigoSalaInput.value).toUpperCase();
  if (codigoEscrito.length !== 6) {
    mostrarMensajeInicio("El código de sala debe tener exactamente 6 caracteres.");
    codigoSalaInput.focus();
    return;
  }

  if (!supabaseClient) {
    mostrarMensajeInicio(
      "Configura Project URL y Publishable key en app.js y verifica que cargue el CDN de Supabase."
    );
    return;
  }

  codigoSala = codigoEscrito;
  esAnfitrion = false;
  void entrarALaSala();
});

document.getElementById("botonSalirSala").addEventListener("click", () => {
  void desconectarseDeSala();
});
botonComenzar.addEventListener("click", iniciarPartida);
document.getElementById("botonGirar").addEventListener("click", girarRuleta);
document.getElementById("botonSiguienteRonda").addEventListener("click", () => {
  ronda += 1;
  document.getElementById("rondaActual").textContent = `Ronda ${ronda}`;
  document.getElementById("jugadorTurno").textContent = "Gira la ruleta para elegir a alguien.";
  shotActual = false;
  document.getElementById("estadoPregunta").textContent = "";
  document.getElementById("tarjetaPregunta").classList.add("oculto");
  document.getElementById("botonGirar").disabled = !esAnfitrion;
  cambiarPantalla("pantallaJuego");
});
document.getElementById("botonTerminarJuego").addEventListener("click", terminarJuego);

prepararEntradaChat("formularioChat", "textoChat", "botonEnviarChat");
prepararEntradaChat("formularioChatJuego", "textoChatJuego", "botonEnviarChatJuego");

nombreJugadorInput.addEventListener("input", () => mostrarMensajeInicio(""));
codigoSalaInput.addEventListener("input", () => mostrarMensajeInicio(""));

window.addEventListener("beforeunload", () => {
  if (!canalSala) {
    return;
  }

  const canalAntesDeCerrar = canalSala;
  canalSala = null;
  void canalAntesDeCerrar.untrack().catch((error) => {
    console.error("Error al quitar Presence al cerrar la pestaña:", error);
  });
  void canalAntesDeCerrar.unsubscribe().catch((error) => {
    console.error("Error al cerrar el canal al cerrar la pestaña:", error);
  });
  void supabaseClient.removeChannel(canalAntesDeCerrar).catch((error) => {
    console.error("Error al eliminar el canal al cerrar la pestaña:", error);
  });
});
