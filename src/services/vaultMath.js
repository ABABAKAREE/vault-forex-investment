const nextSundayFromNowUtc = (baseDate = new Date()) => {
  const result = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 0, 0, 0));
  const day = result.getUTCDay();
  const daysUntilSunday = (7 - day) % 7;
  result.setUTCDate(result.getUTCDate() + daysUntilSunday);
  if (daysUntilSunday === 0 && result <= baseDate) {
    result.setUTCDate(result.getUTCDate() + 7);
  }
  return result;
};

const nextPayoutByCycle = (activatedAt, cycleDays = 7) => {
  const activatedDate = new Date(activatedAt);
  const ms = activatedDate.getTime();
  if (Number.isNaN(ms)) {
    return null;
  }
  const cycleMs = Math.max(1, Number(cycleDays)) * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const elapsed = now - ms;
  const cycleCount = elapsed <= 0 ? 1 : Math.floor(elapsed / cycleMs) + 1;
  return new Date(ms + cycleCount * cycleMs);
};

const DEFAULT_MONTHLY_ROI_PERCENT = 40;

const monthlyRoiFromWeekly = (storedRate) => {
  const rate = Number(storedRate);
  return Number.isFinite(rate) ? rate : DEFAULT_MONTHLY_ROI_PERCENT;
};

const monthlyProfit = (capital, storedRate) => (
  Number(capital) * monthlyRoiFromWeekly(storedRate) / 100
);

const payoutInstallment = (capital, storedRate, installments = 1) => (
  monthlyProfit(capital, storedRate) / Math.max(1, Number(installments))
);

module.exports = {
  nextSundayFromNowUtc,
  nextPayoutByCycle,
  monthlyRoiFromWeekly,
  monthlyProfit,
  payoutInstallment,
};
