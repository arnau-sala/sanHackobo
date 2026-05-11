import { timeToMin } from "../geo/haversine";
import { TimeWindow } from "../types/input.types";

export interface WindowFeasibility {
  feasible: boolean;
  arrivedBeforeOpen: boolean;
  arrivedAfterClose: boolean;
  waitMinutes: number;
  effectiveArrivalMin: number;
}

export function checkTimeWindow(
  projectedArrivalMin: number,
  timeWindow: TimeWindow
): WindowFeasibility {
  const open = timeToMin(timeWindow.from);
  const close = timeToMin(timeWindow.to);

  if (projectedArrivalMin > close) {
    return {
      feasible: false,
      arrivedBeforeOpen: false,
      arrivedAfterClose: true,
      waitMinutes: 0,
      effectiveArrivalMin: projectedArrivalMin,
    };
  }

  const arrivedBeforeOpen = projectedArrivalMin < open;
  const waitMinutes = arrivedBeforeOpen ? open - projectedArrivalMin : 0;
  return {
    feasible: true,
    arrivedBeforeOpen,
    arrivedAfterClose: false,
    waitMinutes,
    effectiveArrivalMin: projectedArrivalMin + waitMinutes,
  };
}
