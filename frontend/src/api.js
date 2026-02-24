const API = "http://localhost:4000/api";

async function http(path, options) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Error");
  return data;
}

export const api = {
  listApps: () => http("/applications"),
  createApp: (name) => http("/applications", { method: "POST", body: JSON.stringify({ name }) }),

  listTickets: (applicationId) => http(`/tickets?applicationId=${applicationId}`),
  createTicket: (applicationId, title) =>
    http("/tickets", { method: "POST", body: JSON.stringify({ applicationId, title }) }),

  addNote: (ticketId, text) =>
    http(`/tickets/${ticketId}/notes`, { method: "POST", body: JSON.stringify({ text }) }),

  setStatus: (ticketId, status) =>
    http(`/tickets/${ticketId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  reorder: (applicationId, status, orderedIds) =>
    http(`/tickets/reorder`, { method: "PATCH", body: JSON.stringify({ applicationId, status, orderedIds }) }),

  updateNote: (ticketId, noteId, text) =>
    http(`/tickets/${ticketId}/notes/${noteId}`, { method: "PATCH", body: JSON.stringify({ text }) }),

  deleteNote: (ticketId, noteId) =>
    http(`/tickets/${ticketId}/notes/${noteId}`, { method: "DELETE" }),

  updateTitle: (ticketId, title) =>
    http(`/tickets/${ticketId}/title`, { method: "PATCH", body: JSON.stringify({ title }) })
};
