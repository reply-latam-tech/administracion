export type PeriodFilterOption = '24M' | 'TODO' | '2027' | '2026' | '2025' | '2024';

export interface Rolling24MRange {
  start: string; // e.g. "2025-11-01"
  end: string;   // e.g. "2027-11-01"
  currentPeriod: string; // e.g. "2026-11-01"
  startLabel: string; // e.g. "Nov 25"
  endLabel: string;   // e.g. "Nov 27"
}

export function getRolling24MonthsRange(refDate = new Date()): Rolling24MRange {
  const d = new Date(refDate);
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-based

  const startDate = new Date(y, m - 12, 1);
  const endDate = new Date(y, m + 12, 1);
  const currDate = new Date(y, m, 1);

  const formatYMD = (dt: Date) => {
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}-01`;
  };

  const formatShort = (dt: Date) => {
    const mes = dt.toLocaleDateString('es-AR', { month: 'short' });
    const capitalized = mes.charAt(0).toUpperCase() + mes.slice(1).replace('.', '');
    const yr = String(dt.getFullYear()).slice(-2);
    return `${capitalized} ${yr}`;
  };

  return {
    start: formatYMD(startDate),
    end: formatYMD(endDate),
    currentPeriod: formatYMD(currDate),
    startLabel: formatShort(startDate),
    endLabel: formatShort(endDate)
  };
}

export function filterPeriodosList(
  sortedPeriodos: string[],
  filter: PeriodFilterOption,
  range24M?: Rolling24MRange
): string[] {
  const range = range24M || getRolling24MonthsRange();
  if (filter === 'TODO') return sortedPeriodos;
  if (filter === '24M') {
    return sortedPeriodos.filter(p => {
      const norm = p.length === 7 ? `${p}-01` : p;
      return norm >= range.start && norm <= range.end;
    });
  }
  return sortedPeriodos.filter(p => p.startsWith(filter));
}

