// Reglamento (CE) 561/2006 — normas de conducción y descanso
const MAX_CONTINUOUS_DRIVE_MIN = 4.5 * 60;   // 270 min → pausa obligatoria
const MANDATORY_BREAK_MIN      = 45;
const MAX_DAILY_DRIVE_MIN      = 9 * 60;     // 540 min (extendible a 10h 2x/semana, ignoramos aquí)
const MAX_DAILY_WORK_MIN       = 13 * 60;    // jornada máxima total

export interface DriverCompliance {
  mustBreakNow: boolean;
  breakDurationMin: number;
  maxRemainingDriveMin: number;
  mustReturnBeforeMin: number;   // minuto del día en que debe estar de vuelta al depósito
  warning?: string;
}

export function checkDriverCompliance(
  continuousDriveMin: number,
  totalDriveMin: number,
  totalWorkMin: number,
  startOfDayMin: number
): DriverCompliance {
  const mustBreakNow = continuousDriveMin >= MAX_CONTINUOUS_DRIVE_MIN;
  const maxRemainingDriveMin = Math.max(0, MAX_DAILY_DRIVE_MIN - totalDriveMin);
  const mustReturnBeforeMin = startOfDayMin + MAX_DAILY_WORK_MIN;

  let warning: string | undefined;
  if (totalDriveMin > MAX_DAILY_DRIVE_MIN * 0.9) {
    warning = `Repartidor al ${Math.round((totalDriveMin / MAX_DAILY_DRIVE_MIN) * 100)}% de la jornada de conducción`;
  }

  return {
    mustBreakNow,
    breakDurationMin: mustBreakNow ? MANDATORY_BREAK_MIN : 0,
    maxRemainingDriveMin,
    mustReturnBeforeMin,
    warning,
  };
}
