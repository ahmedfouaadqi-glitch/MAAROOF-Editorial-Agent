export const DEFAULT_LIMITS = Object.freeze({
  sourceUrlsPerArticle: 3,
  searchesPerArticle: 5,
  inspectionsPerArticle: 5
});

const KEY_BY_OPERATION = {
  source: "sourceUrls",
  search: "searches",
  inspect: "inspections"
};

export function validateLimits(value) {
  const errors = [];
  for (const key of Object.keys(DEFAULT_LIMITS)) {
    const n = value?.[key];
    if (!Number.isSafeInteger(n) || n < 0 || n > 10_000) errors.push(`${key} must be an integer from 0 to 10000`);
  }
  return { valid: errors.length === 0, errors };
}

export function ensureTask(state, taskId, workspaceId) {
  if (!state.tasks[taskId]) {
    state.tasks[taskId] = {
      workspaceId,
      usage: { source: 0, search: 0, inspect: 0 },
      reservations: {},
      createdAt: new Date().toISOString()
    };
  }
  const task = state.tasks[taskId];
  if (task.workspaceId !== workspaceId) {
    const error = new Error("Task does not belong to this workspace");
    error.status = 404;
    throw error;
  }
  return task;
}

export function reserveBudget(state, { taskId, workspaceId, operation, units = 1, reservationId }) {
  if (!KEY_BY_OPERATION[operation]) {
    const error = new Error("operation must be source, search, or inspect");
    error.status = 400;
    throw error;
  }
  if (!Number.isSafeInteger(units) || units < 1 || units > 10_000) {
    const error = new Error("units must be an integer from 1 to 10000");
    error.status = 400;
    throw error;
  }
  if (typeof reservationId !== "string" || reservationId.length < 8 || reservationId.length > 128) {
    const error = new Error("reservationId must be 8-128 characters");
    error.status = 400;
    throw error;
  }
  const task = ensureTask(state, taskId, workspaceId);
  if (task.reservations[reservationId]) {
    const existing = task.reservations[reservationId];
    if (existing.operation !== operation || existing.units !== units) {
      const error = new Error("Reservation ID was already used with different parameters");
      error.status = 409;
      throw error;
    }
    return { allowed: true, replayed: true, ...existing, usage: { ...task.usage } };
  }
  const used = task.usage[operation];
  const limit = state.limits[KEY_BY_OPERATION[operation] + "PerArticle"];
  if (used + units > limit) {
    return { allowed: false, operation, used, limit, remaining: Math.max(0, limit - used), reason: "limit-reached", usage: { ...task.usage } };
  }
  task.usage[operation] += units;
  const reservation = { operation, units, status: "reserved", createdAt: new Date().toISOString() };
  task.reservations[reservationId] = reservation;
  return { allowed: true, replayed: false, operation, used: task.usage[operation], limit, remaining: limit - task.usage[operation], reservationId, usage: { ...task.usage } };
}

export function releaseReservation(state, { taskId, workspaceId, reservationId }) {
  const task = ensureTask(state, taskId, workspaceId);
  const reservation = task.reservations[reservationId];
  if (!reservation) {
    const error = new Error("Reservation not found");
    error.status = 404;
    throw error;
  }
  if (reservation.status === "released") return { released: true, replayed: true, usage: { ...task.usage } };
  if (reservation.status !== "reserved") {
    const error = new Error("Only reserved operations can be released");
    error.status = 409;
    throw error;
  }
  task.usage[reservation.operation] = Math.max(0, task.usage[reservation.operation] - reservation.units);
  reservation.status = "released";
  reservation.releasedAt = new Date().toISOString();
  return { released: true, replayed: false, usage: { ...task.usage } };
}

export function commitReservation(state, { taskId, workspaceId, reservationId }) {
  const task = ensureTask(state, taskId, workspaceId);
  const reservation = task.reservations[reservationId];
  if (!reservation) {
    const error = new Error("Reservation not found");
    error.status = 404;
    throw error;
  }
  if (reservation.status === "committed") return { committed: true, replayed: true };
  if (reservation.status !== "reserved") {
    const error = new Error("Only reserved operations can be committed");
    error.status = 409;
    throw error;
  }
  reservation.status = "committed";
  reservation.committedAt = new Date().toISOString();
  return { committed: true, replayed: false };
}
