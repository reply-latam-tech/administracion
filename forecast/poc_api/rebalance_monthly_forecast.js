/**
 * rebalance_monthly_forecast.js
 * 
 * Rebalanceo Mensual Automático de Proyecciones Futuras (Estacionalidad + Baseline + Inflación)
 * Se ejecuta automáticamente el día 1 de cada mes a las 09:00 ART vía GitHub Actions.
 * 
 * Metodología:
 * 1. Calcula los pesos empíricos de estacionalidad mensual por seller basados en su historia REAL.
 * 2. Determina el volumen base desestacionalizado en moneda constante (promedio últimos 3 meses cerrados).
 * 3. Lee la curva de inflación proyectada (tabla 'inflacion').
 * 4. Actualiza en public.facturacion los meses futuros (periodo > mes_actual) manteniendo intacto el mes corriente.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hnowniqxrtxrrujgnhqj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
    console.error("ERROR: SUPABASE_SERVICE_ROLE_KEY no está configurada.");
    process.exit(1);
}

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

async function fetchJson(endpoint, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
        headers,
        ...options
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Error en ${endpoint} [${res.status}]: ${txt}`);
    }
    return res.json();
}

function getCurrentPeriodArgentina() {
    const now = new Date();
    const dStr = now.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
    const [year, month] = dStr.split("-");
    return `${year}-${month}-01`;
}

async function main() {
    console.log("==================================================================");
    console.log("🚀 INICIANDO REBALANCEO MENSUAL DE PROYECCIONES FUTURAS");
    console.log("==================================================================");

    const currentPeriod = getCurrentPeriodArgentina();
    console.log(`Período de corte actual: ${currentPeriod} (los meses futuros serán > ${currentPeriod})`);

    // 1. Obtener Sellers activos
    console.log("\n1. Obteniendo sellers registrados...");
    const sellers = await fetchJson('dim_sellers?select=id_seller,nombre_seller,pais,moneda&estado=eq.true');
    console.log(`Se encontraron ${sellers.length} sellers activos.`);

    // 2. Obtener curva de inflación
    console.log("\n2. Leyendo proyecciones de inflación...");
    const inflacionData = await fetchJson('inflacion?select=periodo,valor_inflacion,estado&order=periodo.asc');
    const maxInfPeriodo = inflacionData.reduce((max, r) => r.periodo > max ? r.periodo : max, '');
    console.log(`Curva de inflación cargada hasta el período: ${maxInfPeriodo}`);

    function getFactorInflacion(periodoOrigen) {
        let factor = 1.0;
        for (const r of inflacionData) {
            if (r.periodo > periodoOrigen && r.periodo <= maxInfPeriodo) {
                factor *= (1.0 + parseFloat(r.valor_inflacion));
            }
        }
        return factor;
    }

    // 3. Recalcular estacionalidad y proyectar para cada seller
    console.log("\n3. Procesando estacionalidad y forecast futuro por seller...\n");
    let totalFilasActualizadas = 0;

    for (const seller of sellers) {
        const sellerId = seller.id_seller;
        const nombre = seller.nombre_seller;

        // A. Traer datos reales históricos en moneda constante
        const realRows = await fetchJson(
            `facturacion_real_historica?seller_id=eq.${sellerId}&estado=eq.REAL&order=periodo_origen.desc`
        );

        if (!realRows || realRows.length === 0) {
            console.log(`--> ⚠️ Seller ${nombre} (${sellerId}): Sin historial de facturación REAL. Omitiendo.`);
            continue;
        }

        // B. Calcular pesos estacionales para los 12 meses
        const monthMap = {};
        for (let m = 1; m <= 12; m++) monthMap[m] = [];
        for (const r of realRows) {
            const m = parseInt(r.periodo_origen.split('-')[1], 10);
            monthMap[m].push(parseFloat(r.valor_real));
        }

        const monthAvg = {};
        let totalAvg = 0;
        let countMonthsWithData = 0;
        for (let m = 1; m <= 12; m++) {
            if (monthMap[m].length > 0) {
                const avg = monthMap[m].reduce((a, b) => a + b, 0) / monthMap[m].length;
                monthAvg[m] = avg;
                totalAvg += avg;
                countMonthsWithData++;
            } else {
                monthAvg[m] = null;
            }
        }

        const globalAvg = countMonthsWithData > 0 ? (totalAvg / countMonthsWithData) : 1;
        const weights = {};
        const estacionalidadRows = [];
        for (let m = 1; m <= 12; m++) {
            const w = monthAvg[m] !== null && globalAvg > 0 ? (monthAvg[m] / globalAvg) : 1.0;
            weights[m] = w;
            estacionalidadRows.push({
                seller_id: sellerId,
                mes: m,
                indice_peso: w
            });
        }

        // Upsert en estacionalidad_mensual
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/estacionalidad_mensual`, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(estacionalidadRows)
            });
        } catch (e) {
            console.log(`    Aviso: No se pudo actualizar estacionalidad_mensual para ${sellerId}: ${e.message}`);
        }

        // C. Calcular Volumen Base Real Puro (promedio de los últimos 3 meses cerrados)
        const ultimos3 = realRows.slice(0, 3);
        const volumenBaseReal = ultimos3.reduce((sum, r) => sum + parseFloat(r.valor_real), 0) / ultimos3.length;
        const ultimoMesReal = realRows[0].periodo_origen;

        console.log(`📌 Seller: ${nombre} (${sellerId}) | Último mes real: ${ultimoMesReal} | Base constante: $${Math.round(volumenBaseReal).toLocaleString('es-AR')}`);

        // D. Generar y actualizar proyecciones para meses FUTUROS (> currentPeriod)
        const proyeccionesFuturas = [];
        let prevPeriodVal = null;

        // Primero obtener el valor del mes actual proyectado para calcular variación del primer mes futuro
        const currentFactRes = await fetchJson(
            `facturacion?select=valor_facturado&seller_id=eq.${sellerId}&periodo=eq.${currentPeriod}`
        );
        prevPeriodVal = currentFactRes?.[0]?.valor_facturado || null;

        for (const infRow of inflacionData) {
            const mesFuturo = infRow.periodo;
            // Solo proyectamos meses ESTRICTAMENTE FUTUROS (posteriores al mes actual)
            if (mesFuturo <= currentPeriod) continue;

            const mesNum = parseInt(mesFuturo.split('-')[1], 10);
            const peso = weights[mesNum] || 1.0;
            const volumenRealEsperado = volumenBaseReal * peso;
            const factorInf = getFactorInflacion(mesFuturo);
            const volumenNominalProyectado = Math.round(volumenRealEsperado / factorInf);

            let varM = null;
            if (prevPeriodVal && prevPeriodVal > 0) {
                varM = parseFloat(((volumenNominalProyectado - prevPeriodVal) / prevPeriodVal).toFixed(4));
            }

            proyeccionesFuturas.push({
                seller_id: sellerId,
                periodo: mesFuturo,
                valor_facturado: volumenNominalProyectado,
                variacion_mensual: varM,
                estado: 'PROYECTADO'
            });

            prevPeriodVal = volumenNominalProyectado;
        }

        if (proyeccionesFuturas.length > 0) {
            // Upsert en public.facturacion
            const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/facturacion`, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(proyeccionesFuturas)
            });

            if (upsertRes.ok) {
                totalFilasActualizadas += proyeccionesFuturas.length;
                console.log(`    ✅ Proyectados ${proyeccionesFuturas.length} meses futuros (desde ${proyeccionesFuturas[0].periodo} hasta ${proyeccionesFuturas[proyeccionesFuturas.length - 1].periodo})`);
            } else {
                console.error(`    ❌ Error al guardar en facturacion:`, await upsertRes.text());
            }
        }
    }

    console.log("\n==================================================================");
    console.log(`🎉 REBALANCEO FINALIZADO CON ÉXITO: ${totalFilasActualizadas} meses futuros actualizados.`);
    console.log("==================================================================");
}

main().catch(err => {
    console.error("Error fatal en rebalanceo:", err);
    process.exit(1);
});
