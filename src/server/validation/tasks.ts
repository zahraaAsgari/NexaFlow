import { z } from "zod";

/**
 * Tasks input contracts. Only fields the tasks table actually has are
 * validated — projectId, title, assigneeId, status, priority, dueDate.
 * (There is no description column, so none is accepted.)
 *
 * The server is the sole authority: the submitted projectId and assigneeId
 * are re-verified against the active tenant in the data layer.
 */

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;

export const TASK_STATUS_LABELS: Record<
  (typeof TASK_STATUSES)[number],
  string
> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const TASK_PRIORITY_LABELS: Record<
  (typeof TASK_PRIORITIES)[number],
  string
> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * `due_date` is a PostgreSQL `date` column and Drizzle exposes it as a
 * date-only string. Keeping it as a validated YYYY-MM-DD string end to end
 * means no timezone conversion can shift the day the user chose.
 */
const dueDateSchema = z
  .union([
    z.literal(""),
    z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
      .refine((value) => {
        const parsed = new Date(`${value}T00:00:00Z`);
        return (
          !Number.isNaN(parsed.getTime()) &&
          parsed.toISOString().slice(0, 10) === value
        );
      }, "Enter a valid date."),
  ])
  .transform((value) => (value === "" ? null : value));

export const taskFormSchema = z.object({
  projectId: z.uuid("Select a project."),
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(200, "Title is too long."),
  // Empty string means "unassigned", which the nullable column allows.
  assigneeId: z
    .union([z.literal(""), z.uuid("Assignee not found.")])
    .transform((value) => (value === "" ? null : value)),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: dueDateSchema,
});

export type TaskFormInput = z.infer<typeof taskFormSchema>;

/** Route/identifier parameters — validated before any database access. */
export const taskParamsSchema = z.object({
  id: z.uuid("Invalid task."),
});

/** Tasks list query string; only a filter, never an authorization input. */
export const tasksSearchParamsSchema = z.object({
  q: z.string().trim().max(100).catch("").default(""),
  page: z.coerce.number().int().min(1).max(1_000_000).catch(1).default(1),
});
