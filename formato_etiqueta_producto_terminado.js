/**
 * Función compartida para imprimir etiquetas de Producto Terminado (4x3 pulgadas)
 * Se usa tanto en registro.html como en etiquetas_fardo.html
 */
async function imprimirEtiquetaTerminado(printCharacteristic, fardo) {
    if (!printCharacteristic) {
        throw new Error("Impresora no conectada");
    }

    const encoder = new TextEncoder();
    let cmd = "";
    const unidad = fardo.unidad || 'm2';
    const unidadDisplay = unidad === 'ml' ? 'ML' : 'M2';

    // --- CONFIGURACIÓN DE LA ETIQUETA (4x3 pulgadas) ---
    cmd += "SIZE 4,3\r\n"; 
    cmd += "GAP 0.12,0\r\n";
    cmd += "DIRECTION 1\r\n";
    cmd += "CLS\r\n";
    cmd += "DENSITY 12\r\n";

    // --- CÓDIGO DE BARRAS (Fardo No) ---
    // BARCODE x,y,"type",height,human_readable,rotation,narrow,wide,"content"
    cmd += `BARCODE 60,20,"128",60,1,0,3,3,"${fardo.fardoNo}"\r\n`;
    
    // --- ENCABEZADOS ---
    // TEXT x,y,"font",rotation,x-mul,y-mul,alignment,"content"
    // Alignment 2 = Centrado
    cmd += `TEXT 300,125,"3",0,1,1,2,"Lote: ${fardo.lote}"\r\n`;
    cmd += `TEXT 350,45,"3",0,1,1,2,"Fardo: ${fardo.fardoNo}  -  ${fardo.m2} ${unidadDisplay}"\r\n`;

    cmd += `BAR 40,155,720,2\r\n`; // Línea separadora

    // --- DETALLES DEL PRODUCTO ---
    cmd += `TEXT 266,175,"3",0,1,1,2,"${fardo.producto}"\r\n`;
    cmd += `TEXT 206,210,"3",0,1,1,2,"${fardo.grosor} x ${fardo.ancho} pulg  -  ${fardo.especie}"\r\n`;

    cmd += `BAR 40,240,720,2\r\n`; // Línea separadora

    // --- TABLA DE PIEZAS ---
    // Encabezados de columnas
    cmd += `TEXT 60,260,"3",0,1,1,"LARGO"\r\n`;
    cmd += `TEXT 314,260,"3",0,1,1,"PIEZAS"\r\n`;
    cmd += `TEXT 650,260,"3",0,1,1,"${unidadDisplay}"\r\n`;

    // Filas de la tabla
    let y = 290;
    if (fardo.detalles && fardo.detalles.length > 0) {
        fardo.detalles.forEach(d => {
            if (y < 500) { // Evitar que se salga de la etiqueta
                const metros_linea = (unidad === 'ml')
                    ? d.piezas * (d.largo * 0.3048) // Metros lineales
                    : d.piezas * (d.largo * 0.3048) * (fardo.ancho * 0.0254); // Metros cuadrados
                
                cmd += `TEXT 60,${y},"3",0,1,1,"${d.largo}"\r\n`;
                cmd += `TEXT 350,${y},"3",0,1,1,"${d.piezas}"\r\n`;
                cmd += `TEXT 650,${y},"3",0,1,1,"${metros_linea.toFixed(2)}"\r\n`;
                y += 35;
            }
        });
    } else {
        cmd += `TEXT 300,350,"3",0,1,1,"(Detalle no disponible)"\r\n`;
    }

    // --- TOTALES ---
    cmd += `BAR 40,510,720,2\r\n`; // Línea final
    
    const totalPzs = fardo.detalles ? fardo.detalles.reduce((acc, d) => acc + d.piezas, 0) : 0;
    cmd += `TEXT 158,540,"3",0,1,1,"TOTAL PIEZAS: ${totalPzs > 0 ? totalPzs : '-'}"\r\n`;
    cmd += `TEXT 532,540,"3",0,1,1,3,"TOTAL: ${fardo.m2} ${unidadDisplay}"\r\n`; // Align 3 = Derecha

    cmd += "PRINT 1,1\r\n";

    // --- ENVIAR A LA IMPRESORA (Chunking) ---
    const encodedData = encoder.encode(cmd);
    const CHUNK_SIZE = 50;
    for (let i = 0; i < encodedData.length; i += CHUNK_SIZE) {
        await printCharacteristic.writeValue(encodedData.slice(i, i + CHUNK_SIZE));
        await new Promise(resolve => setTimeout(resolve, 20));
    }
}