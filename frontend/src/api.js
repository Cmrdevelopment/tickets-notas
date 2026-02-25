const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const API = `${BASE.replace(/\/$/, '')}/api`;

async function http(path, options) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || 'Error');
  return data;
}

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.apps)) return data.apps;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export const api = {
  // apps
  listApps: async () => toArray(await http('/applications')),
  createApp: (name, parentId = null) => http('/applications', { method: 'POST', body: JSON.stringify({ name, parentId }) }),
  updateApp: (id, name) => http(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteApp: (id) => http(`/applications/${id}`, { method: 'DELETE' }),
  moveApp: (id, parentId = null) => http(`/applications/${id}/move`, { method: 'PATCH', body: JSON.stringify({ parentId }) }),

  // people
  listPeople: async () => toArray(await http('/people')),
  createPerson: (name, color = '') => http('/people', { method: 'POST', body: JSON.stringify({ name, color }) }),

  // tickets
  listTickets: async (applicationId) => toArray(await http(`/tickets?applicationId=${applicationId}`)),
  createTicket: (applicationId, title, createdBy, assignedTo = null) =>
    http('/tickets', { method: 'POST', body: JSON.stringify({ applicationId, title, createdBy, assignedTo }) }),
  deleteTicket: (ticketId) => http(`/tickets/${ticketId}`, { method: 'DELETE' }),

  addNote: (ticketId, text) => http(`/tickets/${ticketId}/notes`, { method: 'POST', body: JSON.stringify({ text }) }),
  updateNote: (ticketId, noteId, text) => http(`/tickets/${ticketId}/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify({ text }) }),
  deleteNote: (ticketId, noteId) => http(`/tickets/${ticketId}/notes/${noteId}`, { method: 'DELETE' }),

  updateTitle: (ticketId, title) => http(`/tickets/${ticketId}/title`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  updateTicketPeople: (ticketId, createdBy, assignedTo = null) =>
    http(`/tickets/${ticketId}/people`, { method: 'PATCH', body: JSON.stringify({ createdBy, assignedTo }) }),

  setStatus: (ticketId, status) => http(`/tickets/${ticketId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  reorder: (applicationId, status, orderedIds) =>
    http('/tickets/reorder', { method: 'PATCH', body: JSON.stringify({ applicationId, status, orderedIds }) }),
};
