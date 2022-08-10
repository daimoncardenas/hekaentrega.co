
const fetch = require("node-fetch");
const { urlToPdfBase64, segmentarString, estandarizarFecha, actualizarMovimientos, actualizarEstado } = require("../extends/funciones");
const credentials = require("../keys/envia");

exports.cotizar = async (req, res) => {
    const {type} = req.params;
    const body = req.body;
    console.log("CREDENCIALES => ", credentials);

    const data = {
        "ciudad_origen": body.ciudad_origen,
        "ciudad_destino": body.ciudad_destino,
        "cod_formapago": 4, // crédito = 4, contraentrega = 7
        "cod_servicio": body.peso >= 9 ? 3 : 12, // 3 (mercacía terrestre) si supera los 9 kilos, 12 (paquete terrestre) si el peso 1-8kg
        "cod_regional_cta": 1,
        "cod_oficina_cta": 1,
        "cod_cuenta": type === "CONVENCIONAL" ? credentials.cod_cuenta : credentials.cod_cuenta_rec,
        "info_cubicacion": [
            {
                "cantidad": 1,
                "largo": body.largo,
                "ancho": body.ancho,
                "alto": body.alto,
                "peso": body.peso,
                "declarado": body.declarado
            }
        ],
        "mca_docinternacional": 0,
        "con_cartaporte": "0",
        "info_contenido": {
            // "num_documentos": "12345-67890",
            "valorproducto": type === "CONVENCIONAL" ? 0 : body.valorproducto // si aplica pago contraentrega, aquí va
        }
    }

    console.log(data);

    const response = await fetch(credentials.endpoint + "/Liquidacion", {
        method: "POST",
        headers: {
            "authorization": credentials.authentication
        },
        body: JSON.stringify(data)
    })
    .then(d => d.json());

    console.log(response);

    res.send(response);
}

exports.crearGuia = async (req, res) => {
    const guia = req.body;
    console.log(guia);
    
    const data = {
        "ciudad_origen": guia.dane_ciudadR,
        "ciudad_destino": guia.dane_ciudadD,
        "cod_formapago": 4,
        "cod_servicio": guia.peso >= 9 ? 3 : 12,
        "info_cubicacion": [{
            "cantidad": 1,
            "largo": guia.largo,
            "ancho": guia.ancho,
            "alto": guia.alto,
            "peso": guia.peso,
            "declarado": guia.seguro
        }],
        "mca_nosabado": 0, //Indica si el sabado el destinatario podrá recibir el pedido
        "mca_docinternacional": 0, //Para exterior
        "cod_regional_cta": 1, 
        "cod_oficina_cta": 1,
        "cod_cuenta": guia.type === "CONVENCIONAL" ? credentials.cod_cuenta : credentials.cod_cuenta_rec,
        "con_cartaporte": 0,
        "info_origen": {
            "nom_remitente": guia.nombreR,
            "dir_remitente": guia.direccionR,
            "tel_remitente": guia.celularR,
            "ced_remitente": 1072497419
        },
        "info_destino": {
            "nom_destinatario": guia.nombreD,
            "dir_destinatario": guia.direccionD,
            "tel_destinatario": guia.telefonoD,
            "ced_destinatario": guia.identificacionD
        },
        "info_contenido": {
            "dice_contener": guia.dice_contener,
            "texto_guia": "",
            "accion_notaguia": "",
            "num_documentos": "12345-67890",
            "centrocosto": "",
            valorproducto: guia.type === "CONVENCIONAL" ? 0 : guia.valor
        },
        "numero_guia": "",
        "generar_os": guia.recoleccion_esporadica ? "S" : "N" // Para solicitar recolección S/N => Si/No
    }

    const response = await fetch(credentials.endpoint + "/Generacion", {
        method: "POST",
        headers: {
            "authorization": credentials.authentication
        },
        body: JSON.stringify(data)
    })
    .then(d => d.json());

    console.log(response);

    res.send(response);

}

exports.obtenerStickerGuia = async (req, res) => {
    const {numeroGuia, url} = req.body;

    const rutaBase = `http://200.69.100.66/2impresionGuiaspruebas/Guia3.aspx?Usuario=${credentials.usuario}&Guia=${numeroGuia}`;

    const ruta = url ? url : rutaBase;
    const base64 = await urlToPdfBase64(ruta);

    if(!base64.includes("JVBERi0xLjQKJ")) return res.json([]);

    const base64Segmented = segmentarString(base64, 500000);
    res.json(base64Segmented);
}


exports.actualizarMovimientos = async (doc) => {
    const numeroGuia = doc.data().numeroGuia;
    const numeroGuiaConsult = numeroGuia.length < 12 ? "0"+numeroGuia : numeroGuia;
    try {
        const respuesta = await fetch(credentials.consultEndpoint + "ConsultaGuia/" + numeroGuiaConsult)
        .then(res => {
            return res.json()
        })
        .catch(err => {
            return {
                status: "error",
                message: err.message
            }
        });
        

        if(respuesta.status === "Falla") {

            const finalizar_seguimiento = doc.data().prueba ? true : false;
            if(finalizar_seguimiento) {
                await funct.actualizarEstado(doc, {
                    estado: "Finalizado",
                    ultima_actualizacion: new Date(),
                    seguimiento_finalizado: finalizar_seguimiento
                });
            }
    
            return [{
                estado: "Error",
                guia: doc.id + " / " + doc.data().numeroGuia + " " + respuesta.message
            }]
        }

        
        
        const estados_finalizacion = ["Documento Anulado", "Entrega Exitosa", "Devuelto al Remitente"];
        
        const movimientos = desglozarMovimientos(respuesta);
        const ultimo_estado = movimientos[movimientos.length - 1];
        let finalizar_seguimiento = doc.data().prueba ? true : false
        console.log(respuesta);
    
        const estado = {
            numeroGuia: respuesta.guia, //guia devuelta por la transportadora
            fechaEnvio: respuesta.fec_despacho,
            ciudadD: respuesta.ciudad_destino,
            nombreD: respuesta.nombre_destinatario,
            direccionD:  respuesta.direccion_destinatario,
            estadoActual: respuesta.estado,
            fecha: ultimo_estado ? ultimo_estado.fechaMov : estandarizarFecha(new Date(), "DD/MM/YYYY HH:mm"), //fecha del estado
            id_heka: doc.id,
            movimientos
        };   

        updte_movs = {
            estado: "Mov.N.A",
            guia: doc.id + " / " + doc.data().numeroGuia + " No contiene movimientos aún."
        }

    
        if(movimientos.length) {
            updte_movs = await actualizarMovimientos(doc, estado);
        }
    
        let enNovedad = false;
        if (updte_movs.estado === "Mov.A" && updte_movs.guardado) {
            enNovedad = updte_movs.guardado.enNovedad || false;
        }
    
        updte_estados = await actualizarEstado(doc, {
            estado: respuesta.estado,
            ultima_actualizacion: new Date(),
            enNovedad,
            seguimiento_finalizado: estados_finalizacion.some(v => respuesta.estado === v)
                || finalizar_seguimiento
        });
    
        return [updte_estados, updte_movs]
    } catch(error) {
        return [{
            estado: "Error",
            guia: doc.id + " / " + doc.data().numeroGuia + " " + error.message
        }]
    }
   
}

function desglozarMovimientos(respuesta) {
    // console.log(respuesta);
    const estadosArmado = {
        'fec_recoleccion': "Recogida",
        'fec_despacho': "En despacho",
        'fec_bodegadestino': "En bodega",
        'fec_reparto': "En reparto",
        fecha_entrega: "Entregado",
        fecha_produccion: "Generada"
    }

    const novedades = respuesta.novedad ? respuesta.novedad : [];

    novedades.map(n =>{
        n.estado = n.novedad;
        n.novedad = n.aclaracion;
        n.observacion = n.comentario;
        n.fechaMov = n.fec_novedad.split("/").reverse().join("/");
        return n;
    });

    const titulos = Object.keys(respuesta)
    .filter(r => /^fec/.test(r))

    console.log("Fechas => ", titulos);

    const movimientos = titulos
    .map(t => {
        const jsonArmado = {
            estado: estadosArmado[t],
            fechaMov: respuesta[t],
            observacion: "",
            novedad: ""
        };

        if(t === "fecha_entrega") {
            jsonArmado.fechaMov = respuesta[t] + " " + respuesta.hora;
        }


        return jsonArmado;
    })
    .concat(novedades)
    .filter(t => t.estado && t.fechaMov)
    .sort((a,b) => {
        if(!a.fechaMov) return -1;
        const i = new Date(a.fechaMov).getTime()
        const f = new Date(b.fechaMov).getTime()
        
        return f > i ? -1 : 1;
    });

    return movimientos
}