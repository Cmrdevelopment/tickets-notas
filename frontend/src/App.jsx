import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardBody,
  Typography,
  Input,
  List,
  ListItem,
  Textarea
} from "@material-tailwind/react";
import { api } from "./api";

const STATUS = [
  { key: "pendiente", label: "Pendiente", accent: "amber" },
  { key: "en_curso", label: "En curso", accent: "blue" },
  { key: "hecho", label: "Hecho", accent: "emerald" }
];

function formatDate(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "";
  }
}

function accentClasses(accent) {
  switch (accent) {
    case "amber":
      return {
        ring: "ring-amber-200",
        header: "bg-amber-50 border-amber-100",
        pill: "bg-amber-100 text-amber-800",
        glow: "from-amber-100/60 to-white",
        hover: "hover:border-amber-200"
      };
    case "blue":
      return {
        ring: "ring-blue-200",
        header: "bg-blue-50 border-blue-100",
        pill: "bg-blue-100 text-blue-800",
        glow: "from-blue-100/60 to-white",
        hover: "hover:border-blue-200"
      };
    case "emerald":
      return {
        ring: "ring-emerald-200",
        header: "bg-emerald-50 border-emerald-100",
        pill: "bg-emerald-100 text-emerald-800",
        glow: "from-emerald-100/60 to-white",
        hover: "hover:border-emerald-200"
      };
    default:
      return {
        ring: "ring-blue-gray-200",
        header: "bg-blue-gray-50 border-blue-gray-100",
        pill: "bg-blue-gray-100 text-blue-gray-800",
        glow: "from-blue-gray-100/60 to-white",
        hover: "hover:border-blue-gray-200"
      };
  }
}

function firstLine(text = "") {
  const t = String(text || "").trim();
  if (!t) return "";
  return t.split("\n")[0].slice(0, 80);
}

export default function App() {
  const [apps, setApps] = useState([]);
  const [appName, setAppName] = useState("");
  const [selectedAppId, setSelectedAppId] = useState(null);

  const [tickets, setTickets] = useState([]);
  const [ticketTitle, setTicketTitle] = useState("");

  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [noteText, setNoteText] = useState("");

  // Edit title / note (sin botones)
  const [editingTitle, setEditingTitle] = useState({ ticketId: null, title: "" });
  const [editingNote, setEditingNote] = useState({ ticketId: null, noteId: null, text: "" });

  // Drag
  const dragRef = useRef({ ticketId: null, fromStatus: null });
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const [dragOverTicketId, setDragOverTicketId] = useState(null);

  const selectedTicket = useMemo(
    () => tickets.find((t) => t._id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );

  const ticketsByStatus = useMemo(() => {
    const map = { pendiente: [], en_curso: [], hecho: [] };
    for (const t of tickets) map[t.status || "pendiente"].push(t);

    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => {
        const ao = Number.isFinite(a.order) ? a.order : 0;
        const bo = Number.isFinite(b.order) ? b.order : 0;
        if (ao !== bo) return ao - bo;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    }
    return map;
  }, [tickets]);

  async function refreshApps() {
    const data = await api.listApps();
    setApps(data);
    if (!selectedAppId && data[0]?._id) setSelectedAppId(data[0]._id);
  }

  async function refreshTickets(appId) {
    if (!appId) return;
    const data = await api.listTickets(appId);
    setTickets(data);

    // si el ticket seleccionado ya no existe, límpialo
    if (selectedTicketId && !data.some((t) => t._id === selectedTicketId)) {
      setSelectedTicketId(null);
    }
  }

  useEffect(() => {
    refreshApps().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshTickets(selectedAppId).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAppId]);

  async function onCreateApp(e) {
    e.preventDefault();
    if (!appName.trim()) return;
    await api.createApp(appName.trim());
    setAppName("");
    await refreshApps();
  }

  async function onCreateTicket(e) {
    e.preventDefault();
    if (!selectedAppId || !ticketTitle.trim()) return;
    await api.createTicket(selectedAppId, ticketTitle.trim());
    setTicketTitle("");
    await refreshTickets(selectedAppId);
  }

  async function onAddNote(e) {
    e.preventDefault();
    if (!selectedTicketId || !noteText.trim()) return;
    const updated = await api.addNote(selectedTicketId, noteText.trim());
    setNoteText("");
    setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
  }

  async function saveEditedTitle() {
    const { ticketId, title } = editingTitle;
    if (!ticketId) return;
    if (!title.trim()) return;

    const updated = await api.updateTitle(ticketId, title.trim());
    setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
    setEditingTitle({ ticketId: null, title: "" });
  }

  async function saveEditedNote() {
    const { ticketId, noteId, text } = editingNote;
    if (!ticketId || !noteId) return;
    if (!text.trim()) return;

    const updated = await api.updateNote(ticketId, noteId, text.trim());
    setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
    setEditingNote({ ticketId: null, noteId: null, text: "" });
  }

  async function deleteNote(ticketId, noteId) {
    const updated = await api.deleteNote(ticketId, noteId);
    setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
    setEditingNote({ ticketId: null, noteId: null, text: "" });
  }

  async function moveTicketToStatus(ticketId, status) {
    const t = tickets.find((x) => x._id === ticketId);
    if (!t) return;
    const current = t.status || "pendiente";
    if (current === status) return;

    setTickets((prev) => prev.map((x) => (x._id === ticketId ? { ...x, status } : x)));

    try {
      const updated = await api.setStatus(ticketId, status);
      setTickets((prev) => prev.map((x) => (x._id === updated._id ? updated : x)));
    } catch (err) {
      setTickets((prev) => prev.map((x) => (x._id === ticketId ? { ...x, status: current } : x)));
      console.error(err);
    }
  }

  async function reorderWithinStatus(statusKey, sourceId, targetId) {
    const ids = ticketsByStatus[statusKey].map((t) => t._id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1 || from === to) return;

    const next = ids.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    setTickets((prev) => {
      const map = new Map(prev.map((t) => [t._id, t]));
      next.forEach((id, idx) => {
        const t = map.get(id);
        if (t) map.set(id, { ...t, order: idx });
      });
      return Array.from(map.values());
    });

    try {
      await api.reorder(selectedAppId, statusKey, next);
      await refreshTickets(selectedAppId);
    } catch (e) {
      console.error(e);
      await refreshTickets(selectedAppId);
    }
  }

  function onDragStartTicket(e, ticketId, statusKey) {
    dragRef.current = { ticketId, fromStatus: statusKey };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", ticketId);
  }

  function onDragEndTicket() {
    dragRef.current = { ticketId: null, fromStatus: null };
    setDragOverStatus(null);
    setDragOverTicketId(null);
  }

  function onDragOverColumn(e, statusKey) {
    e.preventDefault();
    setDragOverStatus(statusKey);
    e.dataTransfer.dropEffect = "move";
  }

  function onDragEnterTicket(_e, ticketId, statusKey) {
    if (dragRef.current.ticketId && dragRef.current.fromStatus === statusKey) {
      setDragOverTicketId(ticketId);
    }
  }

  async function onDropColumn(e, statusKey) {
    e.preventDefault();

    const ticketId = dragRef.current.ticketId || e.dataTransfer.getData("text/plain");
    const fromStatus = dragRef.current.fromStatus;
    const targetId = dragOverTicketId;

    setDragOverStatus(null);
    setDragOverTicketId(null);
    dragRef.current = { ticketId: null, fromStatus: null };

    if (!ticketId) return;

    if (fromStatus === statusKey) {
      if (targetId && targetId !== ticketId) {
        await reorderWithinStatus(statusKey, ticketId, targetId);
      }
      return;
    }

    await moveTicketToStatus(ticketId, statusKey);
  }

  const selectedApp = apps.find((a) => a._id === selectedAppId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <Typography variant="h4" className="text-blue-gray-900">Tickets / Notas</Typography>
          <Typography variant="small" className="text-gray-600">
            {selectedApp ? `App activa: ${selectedApp.name}` : "Crea o selecciona una aplicación"}
          </Typography>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Apps */}
          <Card className="lg:col-span-3 shadow-sm rounded-2xl">
            <CardBody>
              <Typography variant="h6" className="text-blue-gray-900">Aplicaciones</Typography>

              <form className="mt-3" onSubmit={onCreateApp}>
                <Input label="Nueva app (Enter)" value={appName} onChange={(e) => setAppName(e.target.value)} />
                <button type="submit" className="hidden" aria-hidden="true" />
              </form>

              <div className="mt-4 max-h-[65vh] overflow-auto rounded-2xl border bg-white">
                <List>
                  {apps.map((a) => (
                    <ListItem
                      key={a._id}
                      onClick={() => {
                        setSelectedAppId(a._id);
                        setSelectedTicketId(null);
                        setEditingNote({ ticketId: null, noteId: null, text: "" });
                        setEditingTitle({ ticketId: null, title: "" });
                      }}
                      className={[
                        "transition rounded-xl",
                        selectedAppId === a._id ? "bg-blue-50 border border-blue-100" : "hover:bg-gray-50"
                      ].join(" ")}
                    >
                      <div className="flex flex-col">
                        <Typography className="font-semibold text-blue-gray-900">{a.name}</Typography>
                        <Typography variant="small" className="text-gray-600">{formatDate(a.createdAt)}</Typography>
                      </div>
                    </ListItem>
                  ))}
                  {apps.length === 0 && (
                    <Typography className="p-3 text-gray-600">Crea tu primera aplicación.</Typography>
                  )}
                </List>
              </div>
            </CardBody>
          </Card>

          {/* Tablero */}
          <Card className="lg:col-span-6 shadow-sm rounded-2xl">
            <CardBody>
              <Typography variant="h6" className="text-blue-gray-900">Tablero</Typography>

              <form className="mt-3" onSubmit={onCreateTicket}>
                <Input
                  label="Título del ticket (Enter)"
                  value={ticketTitle}
                  onChange={(e) => setTicketTitle(e.target.value)}
                  disabled={!selectedAppId}
                />
                <button type="submit" className="hidden" aria-hidden="true" />
              </form>

              <Typography variant="small" className="mt-2 text-gray-600">
                Click en un ticket = ver <b>título + notas</b> juntas. Drag entre columnas = estado. Drag dentro = prioridad.
              </Typography>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                {STATUS.map((s) => {
                  const isOver = dragOverStatus === s.key;
                  const cx = accentClasses(s.accent);

                  return (
                    <div
                      key={s.key}
                      className={["rounded-2xl border bg-white overflow-hidden", isOver ? `ring-2 ${cx.ring}` : ""].join(" ")}
                      onDragOver={(e) => onDragOverColumn(e, s.key)}
                      onDragEnter={(e) => onDragOverColumn(e, s.key)}
                      onDragLeave={() => setDragOverStatus((prev) => (prev === s.key ? null : prev))}
                      onDrop={(e) => onDropColumn(e, s.key)}
                    >
                      <div className={["border-b px-3 py-2", cx.header].join(" ")}>
                        <div className="flex items-center justify-between">
                          <Typography className="font-semibold text-blue-gray-900">{s.label}</Typography>
                          <span className={["text-xs rounded-full px-2 py-1", cx.pill].join(" ")}>
                            {ticketsByStatus[s.key].length}
                          </span>
                        </div>
                      </div>

                      <div className={["max-h-[55vh] overflow-auto p-2 bg-gradient-to-b", cx.glow].join(" ")}>
                        {ticketsByStatus[s.key].map((t, idx) => {
                          const lastNote = (t.notes || []).slice(-1)[0]?.text || "";
                          return (
                            <div
                              key={t._id}
                              draggable
                              onDragStart={(e) => onDragStartTicket(e, t._id, s.key)}
                              onDragEnd={onDragEndTicket}
                              onDragEnter={(e) => onDragEnterTicket(e, t._id, s.key)}
                              onClick={() => {
                                setSelectedTicketId(t._id);
                                setEditingNote({ ticketId: null, noteId: null, text: "" });
                                setEditingTitle({ ticketId: null, title: "" });
                              }}
                              className={[
                                "rounded-xl border p-3 mb-2 shadow-sm transition cursor-grab active:cursor-grabbing bg-white",
                                cx.hover,
                                selectedTicketId === t._id ? "ring-1 ring-blue-gray-200" : "",
                                dragOverTicketId === t._id &&
                                dragRef.current.ticketId &&
                                dragRef.current.fromStatus === s.key &&
                                dragRef.current.ticketId !== t._id
                                  ? "ring-2 ring-blue-gray-100"
                                  : ""
                              ].join(" ")}
                              title="Arrastra para cambiar estado o prioridad"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <Typography className="font-semibold text-blue-gray-900">{t.title}</Typography>
                                <span className="text-xs rounded-full bg-gray-100 px-2 py-1 text-gray-700">#{idx + 1}</span>
                              </div>

                              <Typography variant="small" className="mt-1 text-gray-600">
                                {t.notes?.length || 0} notas
                              </Typography>

                              {lastNote ? (
                                <Typography variant="small" className="mt-2 text-gray-600">
                                  “{firstLine(lastNote)}”
                                </Typography>
                              ) : (
                                <Typography variant="small" className="mt-2 text-gray-400">
                                  Sin notas aún
                                </Typography>
                              )}
                            </div>
                          );
                        })}

                        {ticketsByStatus[s.key].length === 0 && (
                          <div className="rounded-xl border border-dashed bg-white/80 p-4">
                            <Typography className="text-gray-600">Vacío.</Typography>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* Detalle */}
          <Card className="lg:col-span-3 shadow-sm rounded-2xl">
            <CardBody>
              <Typography variant="h6" className="text-blue-gray-900">Detalle</Typography>

              {!selectedTicket ? (
                <div className="mt-4 rounded-2xl border border-dashed bg-white p-4">
                  <Typography className="text-gray-600">Selecciona un ticket para ver título y notas.</Typography>
                </div>
              ) : (
                <>
                  <div className="mt-3 rounded-2xl border bg-white p-3">
                    {editingTitle.ticketId === selectedTicket._id ? (
                      <Input
                        label="Editando título (Enter guarda, Esc cancela)"
                        value={editingTitle.title}
                        onChange={(e) => setEditingTitle((prev) => ({ ...prev, title: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setEditingTitle({ ticketId: null, title: "" });
                          }
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveEditedTitle().catch(console.error);
                          }
                        }}
                      />
                    ) : (
                      <Typography
                        className="font-semibold text-blue-gray-900 cursor-pointer"
                        title="Click para editar título"
                        onClick={() => setEditingTitle({ ticketId: selectedTicket._id, title: selectedTicket.title })}
                      >
                        {selectedTicket.title}
                      </Typography>
                    )}

                    <Typography variant="small" className="mt-2 text-gray-600">
                      Click en una nota para editar. Guardar: <b>Ctrl+Enter</b> · Cancelar: <b>Esc</b>
                    </Typography>
                  </div>

                  <form className="mt-4" onSubmit={onAddNote}>
                    <Textarea
                      label="Pegar nota nueva. Guardar con Ctrl+Enter"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.ctrlKey && e.key === "Enter") {
                          e.preventDefault();
                          onAddNote(e);
                        }
                      }}
                    />
                    <button type="submit" className="hidden" aria-hidden="true" />
                  </form>

                  <div className="mt-4 max-h-[55vh] overflow-auto space-y-3">
                    {(selectedTicket.notes || []).slice().reverse().map((n) => {
                      const isEditing = editingNote.ticketId === selectedTicket._id && editingNote.noteId === n._id;

                      return (
                        <div
                          key={n._id}
                          className="rounded-2xl border bg-white p-3 shadow-sm"
                          onClick={() => setEditingNote({ ticketId: selectedTicket._id, noteId: n._id, text: n.text })}
                          title="Click para editar"
                        >
                          {!isEditing ? (
                            <>
                              <Typography className="whitespace-pre-wrap text-blue-gray-900">{n.text}</Typography>
                              <Typography variant="small" className="mt-2 text-gray-600">{formatDate(n.at)}</Typography>
                            </>
                          ) : (
                            <>
                              <Textarea
                                label="Editando nota (Ctrl+Enter guarda, Esc cancela)"
                                value={editingNote.text}
                                onChange={(e) => setEditingNote((prev) => ({ ...prev, text: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    e.preventDefault();
                                    setEditingNote({ ticketId: null, noteId: null, text: "" });
                                  }
                                  if (e.ctrlKey && e.key === "Enter") {
                                    e.preventDefault();
                                    saveEditedNote().catch(console.error);
                                  }
                                }}
                              />
                              <Typography
                                variant="small"
                                className="mt-2 text-red-600 cursor-pointer select-none"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNote(selectedTicket._id, n._id).catch(console.error);
                                }}
                              >
                                borrar nota
                              </Typography>
                            </>
                          )}
                        </div>
                      );
                    })}

                    {(selectedTicket.notes || []).length === 0 && (
                      <div className="rounded-2xl border border-dashed bg-white p-4">
                        <Typography className="text-gray-600">Aún no hay notas.</Typography>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
