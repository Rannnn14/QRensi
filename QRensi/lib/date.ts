export const getLocalDateValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const getLocalMonthValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
};

export const shiftMonthValue = (monthValue: string, offset: number) => {
  const [year, month] = monthValue.split("-").map(Number);
  const nextDate = new Date(year, month - 1 + offset, 1);

  return getLocalMonthValue(nextDate);
};
