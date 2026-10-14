export const CLASS_WEEKDAYS = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
] as const;

export const CLASS_SESSION_START_WINDOW_MS = 5 * 60 * 1000;

export function isClassSessionStartAllowed(scheduledAt: string, now = Date.now()) {
  const scheduledTime = Date.parse(scheduledAt);
  return Number.isFinite(scheduledTime) && scheduledTime - now <= CLASS_SESSION_START_WINDOW_MS;
}

export function getClassSessionStartWaitDays(scheduledAt: string, now = Date.now()) {
  const scheduledTime = Date.parse(scheduledAt);
  if (!Number.isFinite(scheduledTime)) return null;
  const waitMs = scheduledTime - now - CLASS_SESSION_START_WINDOW_MS;
  if (waitMs <= 0) return "less than 1 day";
  const days = Math.ceil(waitMs / (24 * 60 * 60 * 1000));
  return days === 1 ? "less than 1 day" : `${days} days`;
}

export function formatRecurringSchedule(days: number[], startTime: string | null | undefined) {
  const selectedDays = CLASS_WEEKDAYS.filter((day) => days.includes(day.value));
  if (!selectedDays.length || !startTime) return "Schedule needs updating";
  const [hour, minute] = startTime.slice(0, 5).split(":").map(Number);
  const time = `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
  return `${selectedDays.map((day) => day.short).join(" & ")} · ${time}`;
}

export function getUpcomingClassSessions(
  days: number[],
  startTime: string | null | undefined,
  from = new Date(),
  weeks = 8,
) {
  if (!days.length || !startTime) return [];
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(from)
    .reduce<Record<string, string>>((parts, part) => {
      parts[part.type] = part.value;
      return parts;
    }, {});
  const today = new Date(
    Date.UTC(Number(dateParts.year), Number(dateParts.month) - 1, Number(dateParts.day)),
  );
  const sessions: Array<{ scheduledAt: string; localDate: string }> = [];
  for (let offset = 0; offset < weeks * 7; offset += 1) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() + offset);
    if (!days.includes(date.getUTCDay())) continue;
    const localDate = date.toISOString().slice(0, 10);
    const scheduledAt = new Date(`${localDate}T${startTime.slice(0, 5)}:00+03:00`);
    if (scheduledAt > from) sessions.push({ scheduledAt: scheduledAt.toISOString(), localDate });
  }
  return sessions;
}

export function parseLegacySchedule(label: string) {
  const dayValues = CLASS_WEEKDAYS.filter((day) =>
    new RegExp(`\\b${day.short}\\w*\\b`, "i").test(label),
  ).map((day) => day.value);
  const timeMatch = label.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!dayValues.length || !timeMatch) return null;
  let hour = Number(timeMatch[1]) % 12;
  if (timeMatch[3].toLowerCase() === "pm") hour += 12;
  const minute = Number(timeMatch[2] ?? 0);
  return {
    days: [...new Set(dayValues)],
    startTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}
