let nombreJugador = "";
let codigoSala = "";
let pantallaActual = "pantallaInicio";

const pantallas = document.querySelectorAll(".pantalla");

const nombreJugadorInput =
  document.getElementById("nombreJugador");

const codigoSalaInput =
  document.getElementById("codigoSala");

const mensajeInicio =
  document.getElementById("mensajeInicio");

const botonCrearSala =
  document.getElementById("botonCrearSala");

const botonUnirseSala =
  document.getElementById("botonUnirseSala");

const botonSalirSala =
  document.getElementById("botonSalirSala");

const botonComenzar =
  document.getElementById("botonComenzar");

const botonGirar =
  document.getElementById("botonGirar");

const botonSiguienteRonda =
  document.getElementById("botonSiguienteRonda");

const botonTerminarJuego =
  document.getElementById("botonTerminarJuego");

function cambiarPantalla(idPantalla) {
  pantallas.forEach(function(pantalla) {
    pantalla.classList.remove("activa");
  });

  document
    .getElementById(idPantalla)
    .classList.add("activa");

  pantallaActual = idPantalla;
}

function mostrarMensajeInicio(mensaje) {
  mensajeInicio.textContent = mensaje;
}

function limpiarTexto(texto) {
  return texto.trim().replace(/\s+/g, " ");
}

function validarNombre() {
  const nombre = limpiarTexto(nombreJugadorInput.value);

  if (nombre.length < 2) {
    mostrarMensajeInicio(
      "Escribe un nombre de al menos 2 caracteres."
    );

    return false;
  }

  if (nombre.length > 20) {
    mostrarMensajeInicio(
      "El nombre no puede tener más de 20 caracteres."
    );

    return false;
  }

  nombreJugador = nombre;
  return true;
}

function generarCodigoSala() {
  const caracteres =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let codigo = "";

  for (let i = 0; i < 6; i++) {
    const posicion = Math.floor(
      Math.random() * caracteres.length
    );

    codigo += caracteres[posicion];
  }

  return codigo;
}

function mostrarDatosSala() {
  document.getElementById(
    "codigoSalaMostrar"
  ).textContent = codigoSala;

  document.getElementById(
    "codigoSalaJuego"
  ).textContent = codigoSala;

  document.getElementById(
    "estadoSala"
  ).textContent =
    `Hola ${nombreJugador}. Esperando jugadores...`;
}

function entrarALaSala() {
  mostrarDatosSala();
  cambiarPantalla("pantallaSala");
}

botonCrearSala.addEventListener("click", function() {
  if (!validarNombre()) {
    return;
  }

  codigoSala = generarCodigoSala();
  entrarALaSala();
});

botonUnirseSala.addEventListener("click", function() {
  if (!validarNombre()) {
    return;
  }

  const codigoEscrito =
    limpiarTexto(codigoSalaInput.value).toUpperCase();

  if (codigoEscrito.length !== 6) {
    mostrarMensajeInicio(
      "El código debe tener 6 caracteres."
    );

    return;
  }

  codigoSala = codigoEscrito;
  entrarALaSala();
});

botonSalirSala.addEventListener("click", function() {
  codigoSala = "";
  cambiarPantalla("pantallaInicio");
});

botonComenzar.addEventListener("click", function() {
  cambiarPantalla("pantallaJuego");
});

botonGirar.addEventListener("click", function() {
  const ruleta = document.getElementById("ruleta");

  botonGirar.disabled = true;
  ruleta.classList.add("girando");

  setTimeout(function() {
    ruleta.classList.remove("girando");

    document.getElementById(
      "jugadorTurno"
    ).textContent =
      "Jugador seleccionado";

    document.getElementById(
      "tarjetaPregunta"
    ).classList.remove("oculto");

    botonGirar.disabled = false;
  }, 1200);
});

botonSiguienteRonda.addEventListener("click", function() {
  cambiarPantalla("pantallaJuego");
});

botonTerminarJuego.addEventListener("click", function() {
  codigoSala = "";
  cambiarPantalla("pantallaInicio");
});

console.log("Interfaz del juego cargada correctamente");