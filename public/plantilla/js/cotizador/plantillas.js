import {
  searchAndRenderCities,
  ciudades,
  selectize,
} from "../consultarCiudades.js";
import { db, collection, getDocs } from "/js/config/initializeFirebase.js";
import {usuarioAltDoc, bodegasWtch } from "/js/cargadorDeDatos.js";
import {ChangeElementContenWhileLoading} from '/js/render.js';
import {watcherPlantilla} from '/js/cotizador.js';

const bodegasEl = $("#list_bodegas-cotizador");
const plantillasEl = $("#list_plantillas-cotizador");
const inpCiudadR = $("#ciudadR");
const inpCiudadD = $("#ciudadD");
const CheckGuardar = $("#guardar_cotizacion-cotizador");
const configGuardado = $("#cont_config_save-cotizador");
const contNombrePlantilla = $("#cont_nom_plant-cotizador");
const formulario = $("#cotizar-envio");
const checkActivarDestinoPlantilla = $("#actv_ciudad_plantilla-cotizador");
const actionEliminarPlantilla = $("#boton_eliminar_plant");
const checkEditPlant = $("#actv_editar_plantilla-cotizador");
const contEditPlant = $("#cont_act_plant-cotizador");
const btnCotizar = $("#boton_cotizar_2");

const referenciaListaPlantillas = collection(usuarioAltDoc(), "plantillasCotizador");


const listaPlantilla = new Map();

bodegasEl.change(cambiarBodegaCotizador);
plantillasEl.change(cambiarPlantillaCotizador);
CheckGuardar.change(mostrarOcultarNombrePlantilla);
actionEliminarPlantilla.click(eliminarPlantillaActual);
checkActivarDestinoPlantilla.change(() => plantillasEl.change());

const charger = new ChangeElementContenWhileLoading(btnCotizar);

export function llenarBodegasCotizador() {
  bodegasWtch.watchFromLast((info) => {
    if (!info) return;

    bodegasEl.html("");

    const opciones = info.map((bodega) => {
      //

      searchAndRenderCities(selectize.ciudadR, bodega.ciudad.split("(")[0]);
      const bodegaEl = `<option value="${bodega.id}">${bodega.nombre}</option>`;
      return bodegaEl;
    });

    opciones.unshift(`<option value>Seleccione Bodega</option>`);

    bodegasEl.html(opciones.join(""));
  });
}

watcherPlantilla.watch(llenarProductos);
export async function llenarProductos(num) {
  try {
    // Obtener los documentos de la colección
    const querySnapshot = await getDocs(referenciaListaPlantillas);

    plantillasEl.html("");
    const opciones = [];
    const listaPlantilla = new Map(); // Asegúrate de que esta esté declarada

    querySnapshot.forEach((d) => {
      const data = d.data();
      if (data.eliminada) return;

      const ciudadBusqueda = ciudades.find(
        (ciudad) =>
          ciudad.dane_ciudad === data.ciudadD ||
          ciudad.nombreAveo === data.ciudadD
      );

      if (!ciudadBusqueda) return;

      opciones.push(`<option value="${d.id}">${data.nombre}</option>`);
      listaPlantilla.set(d.id, { ...data, ciudad: ciudadBusqueda.nombreAveo });

      searchAndRenderCities(
        selectize.ciudadD,
        ciudadBusqueda.nombreAveo.split("(")[0]
      );
    });

    opciones.unshift(`<option value>Seleccione Plantilla</option>`);
    plantillasEl.html(opciones.join(""));
  } catch (error) {
    console.error("Error al llenar los productos:", error);
  }

  if (num) configGuardado.addClass("d-none");

  CheckGuardar.prop("checked", false);
}

window.bodegaSeleccionada = null;

const ciudadesTomadas = new Map();
function cambiarBodegaCotizador(e) {
  const val = e.target.value;

  console.log(val); // si se elimina el cambio de bodegas deja de funcionar

  limpiarInputCiudad(inpCiudadR);

  const bodega = bodegasWtch.value.find((b) => b.id == val);

  if (!bodega) return;

  window.bodegaSeleccionada = bodega;

  console.log(bodegaSeleccionada);

  //buscarCiudad(inpCiudadR, bodega.ciudad);
  llenarInputCiudad(inpCiudadR, bodega);
}

function setearCiudad(inp, data) {
  if (!ciudadesTomadas.has(data.nombre)) ciudadesTomadas.set(data.nombre, data);
  if (data.desactivada) return;

  llenarInputCiudad(inp, data);
  charger.end();
}

function buscarCiudad(el, ciudad) {
  if (!ciudad) return;
  const ciudadString = ciudad
    .normalize("NFD") // Descompone los caracteres acentuados en sus partes (e.g., "á" -> "á")
    .replace(/[\u0300-\u036f]/g, "") // Elimina los caracteres diacríticos (las tildes)
    .toUpperCase();
  charger.init();
  if (ciudadesTomadas.has(ciudadString)) {
    return setearCiudad(el, ciudadesTomadas.get(ciudadString));
  }

  console.warn(ciudadString);

  db.collection("ciudades")
    .where("nombre", "==", ciudadString)
    .limit(3)
    .get()
    .then((q) => {
      q.forEach((doc) => {
        const data = doc.data();

        console.warn(data);
        if (data.desactivada) return;
        setearCiudad(el, data);
      });
    });
}

function cambiarPlantillaCotizador(e) {
  const val = e.target.value;

  console.log(val);
  // Limpiamos los campos donde se ingresa la ciudad del destinatario y remitente
  //limpiarInputCiudad(inpCiudadR);
  limpiarInputCiudad(inpCiudadD);

  formulario[0].reset();

  //buscarCiudad(inpCiudadR, bodega.ciudad);

  if (!val) {
    configGuardado.removeClass("d-none");
    contNombrePlantilla.addClass("d-none");
    actionEliminarPlantilla.addClass("d-none");
    contEditPlant.addClass("d-none");
  } else {
    actionEliminarPlantilla.removeClass("d-none");
    contEditPlant.removeClass("d-none");
    configGuardado.addClass("d-none");
  }

  const plantilla = listaPlantilla.get(val);

  if (!plantilla) return;

  plantilla.tipo_envio ? "" : (plantilla.tipo_envio = "PAGO CONTRAENTREGA");
  const plant = Object.assign({}, plantilla);
  delete plant.ciudadD;
  delete plant.ciudadR;

  const keys = Object.keys(plant);

  keys.forEach((k) => {
    $(`[name="${k}"]`, formulario).val(plant[k]);
  });

  if (checkActivarDestinoPlantilla[0].checked)
    buscarCiudad(inpCiudadD, plantilla.ciudad);

  const controls = {
    sumaEnvio: $("#sumar_envio-cotizador"),
    tipoEnvio: $("#tipo_envio-cotizador"),
    valorRecaudo: $("#recaudo-cotizador"),
    btnCotizarGlobal: $(".cotizador-button"),
  };

  if (plantilla.tipo_envio !== "PAGO CONTRAENTREGA") {
    controls.valorRecaudo.parent().hide("fast");
    controls.valorRecaudo.removeAttr("required");
    controls.sumaEnvio.prop("checked", false);
  } else {
    controls.valorRecaudo.parent().show("fast");
    controls.valorRecaudo.attr("required", true);
  }
}

function llenarInputCiudad(inp, data) {
  console.log(data);
  inp[0].selectize.setValue(data.dane_ciudad);
}

function limpiarInputCiudad(inp) {
  inp[0].selectize.clear();
  const atributos = [
    "id",
    "ciudad",
    "departamento",
    "dane_ciudad",
    "tipo_trayecto",
    "frecuencia",
    "tipo_distribucion",
  ];

  atributos.forEach((a) => inp.removeAttr("data-" + a));
}

function mostrarOcultarNombrePlantilla(e) {
  const checked = e.target.checked;
  const nombrePlantilla = $("#cont_nom_plant-cotizador");

  checked
    ? nombrePlantilla.removeClass("d-none")
    : nombrePlantilla.addClass("d-none");
}

function eliminarPlantillaActual() {
  const idPlantilla = plantillasEl.val();
  Swal.fire({
    icon: "question",
    title: "¿Seguro que seas eliminar esta plantilla?",
    customClass: {
      cancelButton: "btn btn-secondary m-2",
      confirmButton: "btn btn-primary m-2",
    },
    showCancelButton: true,
    showCloseButton: true,
    cancelButtonText: "Cancelar",
    confirmButtonText: "Eliminar",
    buttonsStyling: false,
  }).then((result) => {
    if (result.isConfirmed) {
      referenciaListaPlantillas
        .doc(idPlantilla)
        .update({ eliminada: true })
        .then(() => {
          Toast.fire("Plantilla Eliminada.", "", "success");
          watcherPlantilla.change(1);
        });
    }
  });
}
