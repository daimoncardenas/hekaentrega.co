import AnotacionesPagos from "../pagos/AnotacionesPagos.js";
import { ChangeElementContenWhileLoading } from "../utils/functions.js";
import CreateModal from "../utils/modal.js";
import { idScannerEstados } from "./constantes.js";
import { actualizarEstadoEnvioHeka } from "./crearPedido.js";
import TablaEnvios from "./tablaEnvios.js";
import { formActualizarEstado } from "./views.js";

const principalId = idScannerEstados;
const principalHash = "#" + principalId;
const scannerIdentifier = "id";


const config = { 
    fps: 2, qrbox: {width: 250, height: 250}
    // rememberLastUsedCamera: false,
}

const textsButton = {
    reanudar: "Reanudar escáner",
    detener: "Detener escáner",
    validar: "Validar envío"
}

const idElement = "reader-" + principalId;
const contenedorAnotaciones = $("#anotaciones-" + principalId);
const btnActivador = $("#activador_scanner-" + principalId);
const btnActualizarEstados = $("#actualizar_estados-" + principalId);
const btnActivadorFiles = $("#activador_files-" + principalId);
const btnActivadorLabel = $("#activador_label-" + principalId);
const inputIdEnvio = $("#id_envio-" + principalId);
const fileInput = $("#scanner_files-" + principalId);
const tablaEnvios = $("#contenedor_tabla-" + principalId);

btnActivador.on("click", activadorPrincipal);
btnActualizarEstados.on("click", abrirModalActuaizarEstado);
btnActivadorFiles.on("click", () => fileInput.click());
btnActivadorLabel.on("change", activarInsercionManual);
fileInput.on("change", leerImagenQr);

const tabla = new TablaEnvios(tablaEnvios);
const anotaciones = new AnotacionesPagos(contenedorAnotaciones);

async function onScanSuccess(decodedText, decodedResult) {
    const url = new URL(decodedText);
    const id = url.searchParams.get(scannerIdentifier);
    
    if(id) {
        await stopScanning();

        await encolarEnvioParaActualizacionEstado(id);

        startScanning();
    }
}

const html5QrCode = new Html5Qrcode(idElement);
function stopScanning() {
    return html5QrCode.stop().then(() => {
        btnActivador.text(textsButton.reanudar);
    });
}

function startScanning() {
    html5QrCode.start({facingMode: "environment"}, config, onScanSuccess)
    .then(() => {
        btnActivador.text(textsButton.detener);
    });
}

async function activadorPrincipal(e) {
    anotaciones.reset();
    if(btnActivadorLabel.is(":checked")) {
        const l = new ChangeElementContenWhileLoading(e.target);
        l.init();
        const inputValue = inputIdEnvio.val().trim();
        
        if(!inputValue) return l.end();

        let id = inputValue;
        if(inputValue.length < 12) { // Significa que probablemente la información insertada fue un número de guía y no el id del envío
            const idEncontrado = await db.collection("envios")
            .where("numeroGuia", "==", inputValue)
            .get().then(q => q.size ? q.docs[0].id : null);

            console.log("idEncontrado: ", idEncontrado);

            if(idEncontrado) id = idEncontrado;
        }

        await encolarEnvioParaActualizacionEstado(id)

        l.end();

    } else if(html5QrCode.isScanning) {
        stopScanning();
    } else {
        startScanning();
    }
}

function activarInsercionManual(e) {
    if(html5QrCode.isScanning) stopScanning();

    if(e.target.checked) {
        inputIdEnvio.show("fast");
        btnActivador.text(textsButton.validar);
    } else {
        inputIdEnvio.hide("fast");
        btnActivador.text(textsButton.reanudar);
    }
}

async function leerImagenQr(e) {
    const files = e.target.files;
    if(files.length === 0) return;

    if(html5QrCode.isScanning) await stopScanning();

    anotaciones.reset();
    anotaciones.setContent();

    for(let file of files) {
        const responseAccanner = await html5QrCode.scanFile(file, true)
        .then(value => {
            const url = new URL(value);
            const id = url.searchParams.get(scannerIdentifier);

            if(!id) return {
                icon: "error",
                text: "Por favor ingrese un QR válido"
            }

            return encolarEnvioParaActualizacionEstado(id);
        })
        .catch(err => ({icon: "error", text: `Error al scanear ${file.name}: ${err}`}));

        if(responseAccanner.icon === "error") {
            anotaciones.addError(responseAccanner.text);
        } else {
            anotaciones.addError(responseAccanner.text, {color: "success"});
        }

    }

    anotaciones.addError("Proceso Finalizado", {color: "success"})
}

async function encolarEnvioParaActualizacionEstado(id_envio) {
    Cargador.fire({
        text: "Procesando información, por favor espere."
    });
    
    const ref = db.collection("envios").doc(id_envio);

    const envio = await ref.get().then(d => {
        if(!d.exists) return null;

        const data = d.data();
        data.id = d.id;

        return data;
    });

    if(!envio) {
        return Swal.fire({
            icon: "error",
            text: "El envío con el que se quiere conectar no existe en la base de datos.",
        });
    }

    tabla.add(envio);

    Cargador.close();
}

function abrirModalActuaizarEstado() {
    if(!tabla.table.data().length) return Swal.fire({
        icon: "error",
        text: "No existe ninguna guía en la tabla que actualizar"
    });

    const modal = new CreateModal({
        title: "Actualizar estado"
    });

    modal.init = formActualizarEstado;

    const form = $("form", modal.modal);
    modal.onSubmit = (e) => actualizarEstadoEnvios(e, form[0])
        .then(res => {
            if(res.error) {
                return Swal.fire({
                    icon: "error",
                    text: res.message
                })
            }

            Toast.fire({
                text: res.message,
                icon: "success"
            });
            modal.close();
        });

}

/**
 * 
 * @param {FormData} formData 
 */
async function actualizarEstadoEnvios(e, form) {
    const l = new ChangeElementContenWhileLoading(e.target);
    l.init();
    anotaciones.reset();
    anotaciones.setContent();

    const formData = new FormData(form);
    formData.append("reporter", user_id);
    formData.append("ubicacion", "");
    const data = Object.fromEntries(formData.entries());

    if(!data.estado || !data.descripcion) {
        verificador(["estado-"+principalId, "descripcion-"+principalId], null, "Este campo es obligatorio");
        l.end();
        return {
            error: true,
            message: "Por favor valide los campos obligatorios"
        }
    }

    verificador(); // Limpiamos cualquier verificación previa

    data.esNovedad = !!data.esNovedad;

    const envios = tabla.table.data().toArray();
    let existeError = false;
    tabla.clean();
    while(envios.length) {
        const envio = envios.shift();
        const idEnvio = envio.id;

        const resActualizacion = await actualizarEstadoEnvioHeka(idEnvio, data);
        if(resActualizacion.error) {
            existeError = true;
            anotaciones.addError(envio.numeroGuia + " - " + resActualizacion.body);
            tabla.add(envio);
        }
    }

    l.end();

    return {
        error: existeError,
        message: existeError ? "Hubo al menos un error en una de las guías al actualizar" : "Todas las guías han ssido actualizadas correctamente"
    };
}

export { abrirModalActuaizarEstado }