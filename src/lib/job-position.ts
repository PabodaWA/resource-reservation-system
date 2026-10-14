export const JOB_POSITIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "TEAM_LEADER", label: "Team Leader" },
  { value: "SCRUM_MASTER", label: "Scrum Master" },
  { value: "EMPLOYEE", label: "Employee" },
] as const;

export type JobPosition = (typeof JOB_POSITIONS)[number]["value"];

export const MEMBER_JOB_POSITIONS = JOB_POSITIONS.filter(
  (position) => position.value !== "ADMIN"
);

export function isJobPosition(value: unknown): value is JobPosition {
  return JOB_POSITIONS.some((position) => position.value === value);
}

export function resolveJobPosition(
  role: "ADMIN" | "MEMBER",
  jobPosition: unknown
): JobPosition | null {
  if (role === "ADMIN") {
    return "ADMIN";
  }

  if (!isJobPosition(jobPosition) || jobPosition === "ADMIN") {
    return null;
  }

  return jobPosition;
}

export function jobPositionLabel(value: string): string {
  return (
    JOB_POSITIONS.find((position) => position.value === value)?.label ?? value
  );
}
