const cron = require('node-cron');
const {actualizarMovimientos, actualizarMovimientosSemanales, ocultarOficinas} = require("../controllers/seguimientos");
var firebase = require("../keys/firebase");

cron.schedule("00 */6 * * *", () => {
    let d = new Date();
    console.log("Se vana a ctualizar los movimientos de las guías: ", d);
    actualizarMovimientos().then((detalles) => {
        console.log(detalles);
        firebase.firestore().collection("reporte").add(detalles);
    });
});

cron.schedule("0 0 * * 0", () => {
    let d = new Date();
    console.log("Se vana a ctualizar los movimientos semanales de las guías: ", d);

    // Reiniciar limitador de pagos diarios
    firebase.firestore().collection("infoHeka").doc("manejoUsuarios")
        .update({ limitadosDiario: [] });

    actualizarMovimientosSemanales().then((detalles) => {
        console.log(detalles);
        detalles.actualización_semanal = true;
        firebase.firestore().collection("reporte").add(detalles);
    });
});

cron.schedule("0 0 * * 0", () => {
    ocultarOficinas();
});