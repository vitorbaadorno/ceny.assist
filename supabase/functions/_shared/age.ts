export function calculateAge(dateOfBirth: string | null | undefined, today = new Date()) {
  if (!dateOfBirth) return null;
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  if (!year || !month || !day) return null;

  let age = today.getFullYear() - year;
  const birthdayPending =
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day);
  if (birthdayPending) age -= 1;
  return age >= 0 ? age : null;
}

export function isYoungApprenticeEligible(dateOfBirth: string | null | undefined, today = new Date()) {
  const age = calculateAge(dateOfBirth, today);
  return age !== null && age >= 14 && age <= 24;
}