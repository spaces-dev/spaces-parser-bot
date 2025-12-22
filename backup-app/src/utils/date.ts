export function isNewYearPeriod(): boolean {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  
  if (month === 11) {
    return day >= 15;
  }
  if (month === 0) {
    return day <= 5;
  }
  return false;
}

