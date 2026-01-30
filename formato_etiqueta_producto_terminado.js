/**
 * Función compartida para imprimir etiquetas de Producto Terminado (4x3 pulgadas)
 * Optimizada para impresoras Meitong y navegadores Web Bluetooth (Bluefy)
 */
async function imprimirEtiquetaTerminado(printCharacteristic, fardo, silent = false) {
    if (!printCharacteristic) {
        throw new Error("Impresora no conectada");
    }

    const encoder = new TextEncoder();
    let cmd = "";

    // --- CONFIGURACIÓN DE LA ETIQUETA ---
    // Ajustado según Self-test de la MHT-L1081
    cmd += "SIZE 101 mm, 76 mm\r\n"; 
    cmd += "GAP 3 mm, 0 mm\r\n";
    cmd += "DIRECTION 1\r\n";
    cmd += "CLS\r\n";
    cmd += "DENSITY 12\r\n";

    // --- CÓDIGO DE BARRAS ---
    // Ajustado a x=60 para que no se corte en el margen izquierdo
    cmd += `BARCODE 60,20,"128",60,1,0,3,3,"${fardo.fardoNo}"\r\n`;
    
    // --- ENCABEZADOS ---
    // Nota: La fuente "3" es estándar, pero "TUV.TTF" o "ROMAN.TTF" suelen verse mejor
    cmd += `TEXT 400,125,"3",0,1,1,2,"Lote: ${fardo.lote}"\r\n`;
    cmd += `TEXT 400,45,"3",0,1,1,2,"Fardo: ${fardo.fardoNo} - ${fardo.m2} M2"\r\n`;

    cmd += `BAR 40,155,720,3\r\n`; // Línea más gruesa (3) para mejor visibilidad

    // --- DETALLES DEL PRODUCTO ---
    cmd += `TEXT 400,175,"3",0,1,1,2,"${fardo.producto}"\r\n`;
    cmd += `TEXT 400,210,"3",0,1,1,2,"${fardo.grosor} x ${fardo.ancho} pulg - ${fardo.especie}"\r\n`;

    cmd += `BAR 40,240,720,3\r\n`;

    // --- TABLA DE PIEZAS ---
    cmd += `TEXT 60,260,"3",0,1,1,"LARGO"\r\n`;
    cmd += `TEXT 350,260,"3",0,1,1,"PIEZAS"\r\n`;
    cmd += `TEXT 650,260,"3",0,1,1,"M2"\r\n`;

    let y = 295;
    if (fardo.detalles && fardo.detalles.length > 0) {
        fardo.detalles.forEach(d => {
            if (y < 510) { 
                const m2_linea = d.piezas * (d.largo * 0.3048) * (fardo.ancho * 0.0254);
                
                cmd += `TEXT 60,${y},"3",0,1,1,"${d.largo}"\r\n`;
                cmd += `TEXT 350,${y},"3",0,1,1,"${d.piezas}"\r\n`;
                cmd += `TEXT 650,${y},"3",0,1,1,"${m2_linea.toFixed(2)}"\r\n`;
                y += 35;
            }
        });
    } else {
        cmd += `TEXT 400,350,"3",0,1,1,2,"(Detalle no disponible)"\r\n`;
    }

    // --- TOTALES ---
    cmd += `BAR 40,515,720,3\r\n`;
    
    const totalPzs = fardo.detalles ? fardo.detalles.reduce((acc, d) => acc + d.piezas, 0) : 0;
    cmd += `TEXT 60,540,"3",0,1,1,"TOTAL PIEZAS: ${totalPzs > 0 ? totalPzs : '-'}"\r\n`;
    cmd += `TEXT 760,540,"3",0,1,1,3,"TOTAL: ${fardo.m2} M2"\r\n`;

    cmd += "PRINT 1,1\r\n";

    // --- ENVIAR A LA IMPRESORA (Chunking Optimizado) ---
    const encodedData = encoder.encode(cmd);
    
    /* IMPORTANTE: Bluefy y Meitong funcionan mejor con chunks de 20 bytes 
       y un delay pequeño para no desbordar el búfer de la impresora.
    */
    const CHUNK_SIZE = 20; 
    for (let i = 0; i < encodedData.length; i += CHUNK_SIZE) {
        const chunk = encodedData.slice(i, i + CHUNK_SIZE);
        try {
            // Priorizamos writeWithoutResponse para evitar bloqueos en iOS
            await printCharacteristic.writeValueWithoutResponse(chunk);
        } catch (e) {
            // Fallback en caso de que la característica no soporte el modo anterior
            await printCharacteristic.writeValue(chunk);
        }
        // Aumentamos a 50ms para asegurar que el buffer de la MHT-L1081 no se desborde en iOS
        await new Promise(resolve => setTimeout(resolve, 50)); 
    }

    if (!silent) alert("Etiqueta enviada a " + fardo.fardoNo);
}