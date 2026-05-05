export const MONTH_OPTIONS = [
  { label: "Januari", value: 1 },
  { label: "Februari", value: 2 },
  { label: "Maret", value: 3 },
  { label: "April", value: 4 },
  { label: "Mei", value: 5 },
  { label: "Juni", value: 6 },
  { label: "Juli", value: 7 },
  { label: "Agustus", value: 8 },
  { label: "September", value: 9 },
  { label: "Oktober", value: 10 },
  { label: "November", value: 11 },
  { label: "Desember", value: 12 },
];

export const getYearOptions = (centerYear = new Date().getFullYear(), range = 5) => {
  const years: number[] = [];

  for (let year = centerYear - range; year <= centerYear + range; year += 1) {
    years.push(year);
  }

  return years;
};
