export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function generateSlots(startTime: string, endTime: string, durationMinutes: number) {
  const slots: string[] = [];
  let cursor = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  while (cursor + durationMinutes <= end) {
    slots.push(minutesToTime(cursor));
    cursor += durationMinutes;
  }

  return slots;
}

export function startOfDay(input: Date) {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(input: Date) {
  const date = new Date(input);
  date.setHours(23, 59, 59, 999);
  return date;
}
