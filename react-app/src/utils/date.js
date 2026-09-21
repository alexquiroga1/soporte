export function toLocalISODate(value = new Date()) {
  const source = value && typeof value.toDate === "function" ? value.toDate() : value;
  const date = source instanceof Date ? new Date(source.getTime()) : new Date(source);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function addDaysLocalISO(days = 0, base = new Date()) {
  const source = base && typeof base.toDate === "function" ? base.toDate() : base;
  const date = source instanceof Date ? new Date(source.getTime()) : new Date(source);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setDate(date.getDate() + Number(days || 0));
  return toLocalISODate(date);
}
