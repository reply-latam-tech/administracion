/**
 * Módulo de Tipos de Cambio y Conversión Multimoneda
 * Cotizaciones oficiales de Reply frente a USD (moneda base)
 */

export interface ExchangeRateRow {
  periodo: string; // 'YYYY-MM-DD' o 'YYYY-MM'
  ars: number;
  cop: number;
  clp: number;
  mxn: number;
  pen: number;
  usd: number;
}

// Matriz oficial histórica (2024 a 2027-09)
export const EXCHANGE_RATES: ExchangeRateRow[] = [
  // 2024
  { periodo: '2024-01', ars: 825.0,  cop: 3900.0, clp: 900.0,  mxn: 17.16, pen: 3.75, usd: 1.0 },
  { periodo: '2024-02', ars: 840.0,  cop: 3920.0, clp: 960.0,  mxn: 17.06, pen: 3.78, usd: 1.0 },
  { periodo: '2024-03', ars: 855.0,  cop: 3890.0, clp: 975.0,  mxn: 16.67, pen: 3.70, usd: 1.0 },
  { periodo: '2024-04', ars: 870.0,  cop: 3897.0, clp: 940.0,  mxn: 16.93, pen: 3.72, usd: 1.0 },
  { periodo: '2024-05', ars: 890.0,  cop: 3897.0, clp: 920.0,  mxn: 17.63, pen: 3.74, usd: 1.0 },
  { periodo: '2024-06', ars: 910.0,  cop: 3897.0, clp: 935.0,  mxn: 17.96, pen: 3.79, usd: 1.0 },
  { periodo: '2024-07', ars: 930.0,  cop: 3897.0, clp: 945.0,  mxn: 19.04, pen: 3.74, usd: 1.0 },
  { periodo: '2024-08', ars: 950.0,  cop: 3897.0, clp: 930.0,  mxn: 19.80, pen: 3.74, usd: 1.0 },
  { periodo: '2024-09', ars: 970.0,  cop: 3897.0, clp: 925.0,  mxn: 19.67, pen: 3.75, usd: 1.0 },
  { periodo: '2024-10', ars: 990.0,  cop: 3897.0, clp: 945.0,  mxn: 20.16, pen: 3.76, usd: 1.0 },
  { periodo: '2024-11', ars: 1010.0, cop: 3897.0, clp: 970.0,  mxn: 20.42, pen: 3.78, usd: 1.0 },
  { periodo: '2024-12', ars: 1025.0, cop: 3897.0, clp: 985.0,  mxn: 20.27, pen: 3.77, usd: 1.0 },
  
  // 2025
  { periodo: '2025-01', ars: 1032.0, cop: 3950.0, clp: 996.46, mxn: 19.50, pen: 3.75, usd: 1.0 },
  { periodo: '2025-02', ars: 1046.0, cop: 3970.0, clp: 956.90, mxn: 19.60, pen: 3.76, usd: 1.0 },
  { periodo: '2025-03', ars: 1060.0, cop: 3990.0, clp: 946.59, mxn: 19.70, pen: 3.77, usd: 1.0 },
  { periodo: '2025-04', ars: 1197.74,cop: 4305.02,clp: 940.18, mxn: 19.61, pen: 3.70, usd: 1.0 },
  { periodo: '2025-05', ars: 1150.0, cop: 4107.0, clp: 935.00, mxn: 19.23, pen: 3.66, usd: 1.0 },
  { periodo: '2025-06', ars: 1215.0, cop: 3974.37,clp: 926.62, mxn: 18.83, pen: 3.62, usd: 1.0 },
  { periodo: '2025-07', ars: 1330.0, cop: 4097.38,clp: 964.28, mxn: 18.80, pen: 3.56, usd: 1.0 },
  { periodo: '2025-08', ars: 1330.0, cop: 4016.0, clp: 965.28, mxn: 18.65, pen: 3.54, usd: 1.0 },
  { periodo: '2025-09', ars: 1450.0, cop: 3897.0, clp: 959.19, mxn: 18.35, pen: 3.50, usd: 1.0 },
  { periodo: '2025-10', ars: 1480.0, cop: 3800.0, clp: 940.53, mxn: 18.54, pen: 3.43, usd: 1.0 },
  { periodo: '2025-11', ars: 1420.0, cop: 3784.0, clp: 928.00, mxn: 18.35, pen: 3.37, usd: 1.0 },
  { periodo: '2025-12', ars: 1450.0, cop: 3790.77,clp: 911.18, mxn: 18.00, pen: 3.37, usd: 1.0 },

  // 2026 Reales
  { periodo: '2026-01', ars: 1430.0, cop: 3622.0, clp: 860.00, mxn: 17.29, pen: 3.36, usd: 1.0 },
  { periodo: '2026-02', ars: 1395.0, cop: 3769.0, clp: 884.21, mxn: 17.22, pen: 3.36, usd: 1.0 },
  { periodo: '2026-03', ars: 1405.0, cop: 3660.0, clp: 927.46, mxn: 18.00, pen: 3.44, usd: 1.0 },
  { periodo: '2026-04', ars: 1420.0, cop: 3660.0, clp: 903.05, mxn: 17.47, pen: 3.51, usd: 1.0 },
  { periodo: '2026-05', ars: 1427.0, cop: 3562.0, clp: 892.91, mxn: 17.29, pen: 3.39, usd: 1.0 },
  { periodo: '2026-06', ars: 1490.0, cop: 3440.83,clp: 922.21, mxn: 17.51, pen: 3.39, usd: 1.0 },
  { periodo: '2026-07', ars: 1525.0, cop: 3205.80,clp: 941.93, mxn: 17.46, pen: 3.41, usd: 1.0 },
  { periodo: '2026-08', ars: 1530.0, cop: 3213.97,clp: 929.18, mxn: 16.97, pen: 3.40, usd: 1.0 },
  { periodo: '2026-09', ars: 1565.0, cop: 3312.84,clp: 972.60, mxn: 18.07, pen: 3.36, usd: 1.0 },

  // 2026 - 2027 Proyectados
  { periodo: '2026-10', ars: 1590.0, cop: 3325.0, clp: 975.00, mxn: 18.12, pen: 3.36, usd: 1.0 },
  { periodo: '2026-11', ars: 1615.0, cop: 3340.0, clp: 978.00, mxn: 18.18, pen: 3.37, usd: 1.0 },
  { periodo: '2026-12', ars: 1645.0, cop: 3360.0, clp: 982.00, mxn: 18.25, pen: 3.37, usd: 1.0 },
  { periodo: '2027-01', ars: 1670.0, cop: 3375.0, clp: 985.00, mxn: 18.32, pen: 3.38, usd: 1.0 },
  { periodo: '2027-02', ars: 1695.0, cop: 3390.0, clp: 989.00, mxn: 18.38, pen: 3.38, usd: 1.0 },
  { periodo: '2027-03', ars: 1720.0, cop: 3410.0, clp: 993.00, mxn: 18.45, pen: 3.39, usd: 1.0 },
  { periodo: '2027-04', ars: 1745.0, cop: 3425.0, clp: 998.00, mxn: 18.52, pen: 3.39, usd: 1.0 },
  { periodo: '2027-05', ars: 1770.0, cop: 3440.0, clp: 1002.0, mxn: 18.60, pen: 3.40, usd: 1.0 },
  { periodo: '2027-06', ars: 1795.0, cop: 3455.0, clp: 1006.0, mxn: 18.68, pen: 3.40, usd: 1.0 },
  { periodo: '2027-07', ars: 1820.0, cop: 3470.0, clp: 1010.0, mxn: 18.75, pen: 3.41, usd: 1.0 },
  { periodo: '2027-08', ars: 1845.0, cop: 3485.0, clp: 1014.0, mxn: 18.82, pen: 3.41, usd: 1.0 },
  { periodo: '2027-09', ars: 1870.0, cop: 3500.0, clp: 1018.0, mxn: 18.90, pen: 3.42, usd: 1.0 },
];

const rateMapByPeriod = new Map<string, ExchangeRateRow>();
EXCHANGE_RATES.forEach(r => {
  const p7 = r.periodo.substring(0, 7);
  rateMapByPeriod.set(p7, r);
  rateMapByPeriod.set(r.periodo, r);
});

// Fallback por defecto si no se encuentra el período exacto
const DEFAULT_FALLBACK_RATE: ExchangeRateRow = {
  periodo: 'fallback',
  ars: 1500.0,
  cop: 3350.0,
  clp: 950.0,
  mxn: 18.0,
  pen: 3.4,
  usd: 1.0
};

/**
 * Obtiene la cotización de una moneda frente a 1 USD para un período dado
 */
export function getRateToUSD(currency: string, periodo: string): number {
  const c = (currency || 'USD').trim().toUpperCase();
  if (c === 'USD') return 1.0;

  const pKey = periodo.substring(0, 7);
  const row = rateMapByPeriod.get(pKey) || DEFAULT_FALLBACK_RATE;

  switch (c) {
    case 'ARS': return row.ars || 1500.0;
    case 'COP': return row.cop || 3350.0;
    case 'CLP': return row.clp || 950.0;
    case 'MXN': return row.mxn || 18.0;
    case 'PEN': return row.pen || 3.4;
    default: return 1.0;
  }
}

/**
 * Convierte un monto de una moneda a otra en un período determinado
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  periodo: string
): number {
  if (!amount || amount === 0) return 0;
  const from = (fromCurrency || 'USD').trim().toUpperCase();
  const to = (toCurrency || 'USD').trim().toUpperCase();
  if (from === to) return amount;

  // Paso 1: Convertir de fromCurrency a USD
  const rateFrom = getRateToUSD(from, periodo);
  const amountUSD = rateFrom > 0 ? amount / rateFrom : amount;

  // Paso 2: Si el destino es USD, retornamos
  if (to === 'USD') return amountUSD;

  // Paso 3: Convertir de USD a toCurrency
  const rateTo = getRateToUSD(to, periodo);
  return amountUSD * rateTo;
}

/**
 * Formateador de moneda con símbolo, código y opción compacta
 */
export function formatMoney(
  amount: number,
  currency: string = 'USD',
  compact: boolean = false
): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '-';
  const cur = (currency || 'USD').trim().toUpperCase();

  const locale = cur === 'USD' ? 'en-US' : (cur === 'ARS' ? 'es-AR' : (cur === 'COP' ? 'es-CO' : (cur === 'CLP' ? 'es-CL' : 'es-MX')));

  if (compact) {
    const compactFmt = new Intl.NumberFormat(locale, {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1
    }).format(amount);
    return `${cur === 'USD' ? '$' : '$ '} ${compactFmt} ${cur}`;
  }

  const numFmt = new Intl.NumberFormat(locale, {
    minimumFractionDigits: cur === 'USD' ? 2 : 0,
    maximumFractionDigits: cur === 'USD' ? 2 : 0
  }).format(amount);

  return `$ ${numFmt} ${cur}`;
}
