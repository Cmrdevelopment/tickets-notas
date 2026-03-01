import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardBody,
  Typography,
  Input,
  List,
  ListItem,
  Textarea,
} from "@material-tailwind/react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
} from "@dnd-kit/core";
import { api } from "./api";

const STATUS = [
  { key: "pendiente", label: "Pendiente", accent: "amber" },
  { key: "en_curso", label: "En curso", accent: "blue" },
  { key: "hecho", label: "Hecho", accent: "emerald" },
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
        header: "bg-amber-50 border-amber-100",
        pill: "bg-amber-100 text-amber-800",
        hover: "hover:border-amber-200",
      };
    case "blue":
      return {
        header: "bg-blue-50 border-blue-100",
        pill: "bg-blue-100 text-blue-800",
        hover: "hover:border-blue-200",
      };
    case "emerald":
      return {
        header: "bg-emerald-50 border-emerald-100",
        pill: "bg-emerald-100 text-emerald-800",
        hover: "hover:border-emerald-200",
      };
    default:
      return {
        header: "bg-blue-gray-50 border-blue-gray-100",
        pill: "bg-blue-gray-100 text-blue-gray-800",
        hover: "hover:border-blue-gray-200",
      };
  }
}

function firstLine(text = "") {
  const t = String(text || "").trim();
  if (!t) return "";
  return t.split("\n")[0].slice(0, 80);
}

function initials(name = "") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase();
}

function appDisplayName(app, appsArr) {
  if (!app) return "—";
  const parent = app.parentId
    ? appsArr.find((a) => String(a._id) === String(app.parentId))
    : null;
  return parent ? `${app.name} (${parent.name})` : app.name;
}

function buildAppTree(appsArr) {
  const byId = new Map(
    appsArr.map((a) => [String(a._id), { ...a, children: [] }])
  );
  const roots = [];
  for (const a of byId.values()) {
    const pid = a.parentId ? String(a.parentId) : null;
    if (pid && byId.has(pid)) byId.get(pid).children.push(a);
    else roots.push(a);
  }
  const sortRec = (nodes) => {
    nodes.sort(
      (x, y) =>
        (x.order ?? 0) - (y.order ?? 0) ||
        new Date(x.createdAt) - new Date(y.createdAt)
    );
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function flattenAppTree(nodes, depth = 0, out = []) {
  for (const n of nodes) {
    out.push({ ...n, depth });
    if (n.children?.length) flattenAppTree(n.children, depth + 1, out);
  }
  return out;
}

function InlineToast({ show, msg, type }) {
  if (!show) return null;
  const cls =
    type === "error"
      ? "bg-red-50 border-red-200 text-red-800"
      : type === "ok"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : "bg-blue-50 border-blue-200 text-blue-800";

  return (
    <div className={`mt-2 px-3 py-2 rounded-xl border text-sm font-semibold ${cls}`}>
      {msg}
    </div>
  );
}

function Modal({ open, title, children, footer, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full md:w-[560px] h-[88vh] md:h-auto md:max-h-[88vh] rounded-t-3xl md:rounded-3xl bg-white shadow-xl border overflow-hidden flex flex-col">
        {/* header */}
        <div className="sticky top-0 z-20 p-3 md:p-4 border-b bg-white flex items-center justify-between">
          <Typography variant="h6" className="text-blue-gray-900">
            {title}
          </Typography>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-sm"
            type="button"
          >
            Cerrar
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-auto p-3 md:p-4 pb-28">{children}</div>

        {/* footer */}
        {footer ? (
          <div className="sticky bottom-0 z-20 border-t bg-white p-3 md:p-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ActionBtn({ title, onClick, children, variant = "neutral" }) {
  const base =
    "h-8 w-8 grid place-items-center rounded-full border text-xs font-semibold transition active:scale-[0.98]";
  const styles = {
    neutral: "bg-white border-gray-200 text-gray-700 hover:bg-gray-50",
    danger: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100",
    primary:
      "bg-blue-gray-900 border-blue-gray-900 text-white hover:bg-blue-gray-800",
  };
  return (
    <button
      title={title}
      onClick={onClick}
      className={`${base} ${styles[variant]}`}
      type="button"
    >
      {children}
    </button>
  );
}

function AppRow({ app, depth, active, onSelect, onRename, onDelete, onMoveRoot }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: String(app._id) });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: String(app._id),
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div ref={setDropRef}>
      <ListItem
        ref={setNodeRef}
        style={style}
        onClick={() => onSelect(app._id)}
        className={[
          "transition rounded-xl flex items-center justify-between gap-2",
          "py-2 px-2",
          active ? "bg-blue-50 border border-blue-100" : "hover:bg-gray-50",
          isOver ? "ring-2 ring-blue-gray-100" : "",
          isDragging ? "opacity-70" : "",
        ].join(" ")}
      >
        <div
          className="min-w-0 flex-1 pr-2"
          style={{ paddingLeft: `${depth * 14}px` }}
        >
          <Typography className="font-semibold text-blue-gray-900 break-words leading-5">
            {app.name}
          </Typography>
          <Typography variant="small" className="text-gray-600">
            {formatDate(app.createdAt)}
          </Typography>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {app.parentId ? (
            <ActionBtn
              title="Mover a raíz"
              onClick={(e) => {
                e.stopPropagation();
                onMoveRoot(app);
              }}
            >
              ↑
            </ActionBtn>
          ) : null}

          <ActionBtn
            title="Editar nombre"
            onClick={(e) => {
              e.stopPropagation();
              onRename(app);
            }}
          >
            ✎
          </ActionBtn>

          <ActionBtn
            title="Borrar aplicación"
            variant="danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(app);
            }}
          >
            🗑
          </ActionBtn>

          <button
            type="button"
            className="h-8 w-8 grid place-items-center rounded-full border bg-white border-gray-200 text-gray-700 hover:bg-gray-50 cursor-grab active:scale-[0.98]"
            title="Arrastra para anidar (suéltala encima de otra app)"
            onClick={(e) => e.stopPropagation()}
            {...listeners}
            {...attributes}
          >
            ⋮⋮
          </button>
        </div>
      </ListItem>
    </div>
  );
}

export default function App() {
  const [apps, setApps] = useState([]);
  const [appName, setAppName] = useState("");
  const [selectedAppId, setSelectedAppId] = useState(null);

  const [people, setPeople] = useState([]);
  const [peopleModal, setPeopleModal] = useState({ open: false, name: "", color: "" });

  const [tickets, setTickets] = useState([]);
  const [ticketTitle, setTicketTitle] = useState("");
  const [newCreatedBy, setNewCreatedBy] = useState("");
  const [newAssignedTo, setNewAssignedTo] = useState("");

  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [noteText, setNoteText] = useState("");

  const [editingTitle, setEditingTitle] = useState({ ticketId: null, title: "" });
  const [editingNote, setEditingNote] = useState({ ticketId: null, noteId: null, text: "" });

  const [ticketModalOpen, setTicketModalOpen] = useState(false);

  const [guideMobileOpen, setGuideMobileOpen] = useState(false);

  // loading states
  const [creatingApp, setCreatingApp] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingTicketPeople, setSavingTicketPeople] = useState(false);

  // guía (arriba del tablero)
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTab, setGuideTab] = useState("basico"); // "basico" | "atajos"

  // toast inline por zona
  const [toast, setToast] = useState({
    open: false,
    msg: "",
    type: "info",
    where: "app", // "app" | "ticket" | "modal"
  });

  function showToast(msg, type = "info", where = "app") {
    setToast({ open: true, msg, type, where });

    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      setToast({ open: false, msg: "", type: "info", where: "app" });
    }, 2200);
  }

  // Drag tickets
  const dragRef = useRef({ ticketId: null, fromStatus: null });
  const closeTicketModalTRef = useRef(null);
  const noteInputRef = useRef(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const [dragOverTicketId, setDragOverTicketId] = useState(null);

  useEffect(() => {
    return () => {
      if (closeTicketModalTRef.current) clearTimeout(closeTicketModalTRef.current);
    };
  }, []);

  // DnD apps
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const appsArr = Array.isArray(apps) ? apps : [];

  const selectedTicket = useMemo(
    () =>
      (Array.isArray(tickets) ? tickets : []).find((t) => t._id === selectedTicketId) ||
      null,
    [tickets, selectedTicketId]
  );

  const selectedApp = useMemo(
    () => appsArr.find((a) => a._id === selectedAppId) || null,
    [appsArr, selectedAppId]
  );

  const appTree = useMemo(() => buildAppTree(appsArr), [appsArr]);
  const flattenedApps = useMemo(() => flattenAppTree(appTree), [appTree]);

  const peopleById = useMemo(() => {
    const m = new Map();
    for (const p of people) m.set(String(p._id), p);
    return m;
  }, [people]);

  const ticketsByStatus = useMemo(() => {
    const map = { pendiente: [], en_curso: [], hecho: [] };
    for (const t of (Array.isArray(tickets) ? tickets : []))
      map[t.status || "pendiente"].push(t);

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
    const arr = await api.listApps();
    setApps(arr);
    if (!selectedAppId && arr?.[0]?._id) setSelectedAppId(arr[0]._id);
  }

  async function refreshPeople() {
    const arr = await api.listPeople();
    setPeople(arr);
  }

  async function refreshTickets(appId) {
    if (!appId) return;
    const arr = await api.listTickets(appId);
    setTickets(arr);
  }

  useEffect(() => {
    refreshApps().catch(console.error);
    refreshPeople().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshTickets(selectedAppId).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAppId]);

  // ==========================
  // Crear App
  // ==========================
  async function onCreateApp() {
    if (creatingApp) return;

    const name = String(appName || "").trim();
    if (!name) {
      showToast("Te falta el nombre de la app.", "error", "app");
      return;
    }

    showToast("Creando app…", "info", "app");

    try {
      setCreatingApp(true);
      await api.createApp(name, null);
      setAppName("");
      await refreshApps();
      showToast("✅ Creada nueva app", "ok", "app");
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Error creando la aplicación", "error", "app");
    } finally {
      setCreatingApp(false);
    }
  }

  // ==========================
  // Crear Ticket  ✅ CORREGIDO
  // ==========================
  async function onCreateTicket() {
    if (creatingTicket) return;

    const missing = [];
    if (!selectedAppId) missing.push("selecciona una app");
    if (!String(ticketTitle || "").trim()) missing.push("título");
    if (!newCreatedBy) missing.push("quién lo abre");

    if (missing.length) {
      const msg =
        missing.length === 1
          ? `Te falta: ${missing[0]}.`
          : `Te falta: ${missing.join(" y ")}.`;
      showToast(msg, "error", "ticket");
      return;
    }

    showToast("Creando ticket…", "info", "ticket");

    try {
      setCreatingTicket(true);

      const created = await api.createTicket(
        selectedAppId,
        String(ticketTitle).trim(),
        newCreatedBy,
        newAssignedTo || null
      );

      setTicketTitle("");
      setNewAssignedTo("");

      // Si el API devuelve el ticket creado, lo abrimos directo:
      if (created && created._id) {
        setTickets((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          const exists = arr.some((t) => String(t._id) === String(created._id));
          return exists ? arr : [created, ...arr];
        });

        openTicket(created); // ✅ abre el modal
        await bringTicketToTop(
          selectedAppId,
          created.status || "pendiente",
          created._id
        );
      } else {
        // ✅ fallback correcto: NO uses `tickets` (estado viejo)
        const arr = await api.listTickets(selectedAppId);
        setTickets(arr);

        const latest =
          (Array.isArray(arr) ? arr : [])
            .slice()
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0] ||
          null;

        if (latest) openTicket(latest);
        await bringTicketToTop(selectedAppId, latest.status || "pendiente", latest._id);
      }

      showToast("✅ Ticket creado", "ok", "ticket");
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Error creando el ticket", "error", "ticket");
    } finally {
      setCreatingTicket(false);
    }
  }

  // ==========================
  // Notas
  // ==========================
  async function onAddNote() {
    if (addingNote) return;
    if (!selectedTicketId) {
      showToast("No hay ticket seleccionado.", "error", "modal");
      return;
    }

    const txt = String(noteText || "").trim();
    if (!txt) {
      showToast("Escribe una nota antes de añadir.", "error", "modal");
      return;
    }

    showToast("Añadiendo nota…", "info", "modal");

    try {
      setAddingNote(true);
      const updated = await api.addNote(selectedTicketId, txt);
      setNoteText("");
      setTickets((prev) =>
        (Array.isArray(prev) ? prev : []).map((t) => (t._id === updated._id ? updated : t))
      );
      showToast("✅ Nota añadida", "ok", "modal");
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Error añadiendo la nota", "error", "modal");
    } finally {
      setAddingNote(false);
    }
  }

  async function saveEditedTitle() {
    if (savingTitle) return;

    const { ticketId, title } = editingTitle;
    const t = String(title || "").trim();
    if (!ticketId || !t) {
      showToast("El título no puede estar vacío.", "error", "modal");
      return;
    }

    showToast("Guardando título…", "info", "modal");

    try {
      setSavingTitle(true);
      const updated = await api.updateTitle(ticketId, t);
      setTickets((prev) =>
        (Array.isArray(prev) ? prev : []).map((x) => (x._id === updated._id ? updated : x))
      );
      setEditingTitle({ ticketId: null, title: "" });
      showToast("✅ Título guardado", "ok", "modal");
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Error guardando el título", "error", "modal");
    } finally {
      setSavingTitle(false);
    }
  }

  async function saveEditedNote() {
    if (savingNote) return;

    const { ticketId, noteId, text: body } = editingNote;
    const t = String(body || "").trim();
    if (!ticketId || !noteId || !t) {
      showToast("La nota no puede estar vacía.", "error", "modal");
      return;
    }

    showToast("Guardando nota…", "info", "modal");

    try {
      setSavingNote(true);
      const updated = await api.updateNote(ticketId, noteId, t);
      setTickets((prev) =>
        (Array.isArray(prev) ? prev : []).map((x) => (x._id === updated._id ? updated : x))
      );
      setEditingNote({ ticketId: null, noteId: null, text: "" });
      showToast("✅ Nota guardada", "ok", "modal");
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Error guardando la nota", "error", "modal");
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteNote(ticketId, noteId) {
    const ok = confirm("¿Borrar esta nota? (No se puede deshacer)");
    if (!ok) return;

    showToast("Borrando nota…", "info", "modal");

    try {
      const updated = await api.deleteNote(ticketId, noteId);
      setTickets((prev) =>
        (Array.isArray(prev) ? prev : []).map((t) => (t._id === updated._id ? updated : t))
      );
      setEditingNote({ ticketId: null, noteId: null, text: "" });
      showToast("✅ Nota borrada", "ok", "modal");
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Error borrando la nota", "error", "modal");
    }
  }

  async function deleteTicket(ticketId) {
    const ok = confirm("¿Borrar este ticket y todas sus notas? (No se puede deshacer)");
    if (!ok) return;

    showToast("Borrando ticket…", "info", "modal");

    try {
      await api.deleteTicket(ticketId);
      setTickets((prev) => (Array.isArray(prev) ? prev : []).filter((t) => t._id !== ticketId));
      setSelectedTicketId(null);
      setTicketModalOpen(false);
      showToast("✅ Ticket borrado", "ok", "modal");
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Error borrando el ticket", "error", "modal");
    }
  }

  async function saveTicketPeople(ticket) {
    if (savingTicketPeople) return;

    if (!ticket?.createdBy) {
      showToast("El campo ABRE es obligatorio.", "error", "modal");
      return;
    }

    showToast("Guardando cambios…", "info", "modal");

    try {
      setSavingTicketPeople(true);

      const updated = await api.updateTicketPeople(
        ticket._id,
        ticket.createdBy,
        ticket.assignedTo || null
      );

      setTickets((prev) =>
        (Array.isArray(prev) ? prev : []).map((t) => (t._id === updated._id ? updated : t))
      );

      showToast("✅ Cambios guardados", "ok", "modal");

      // ✅ cerrar modal en 2s
      if (closeTicketModalTRef.current) clearTimeout(closeTicketModalTRef.current);
      closeTicketModalTRef.current = setTimeout(() => {
        setTicketModalOpen(false);
      }, 2000);
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Error guardando cambios", "error", "modal");
    } finally {
      setSavingTicketPeople(false);
    }
  }

  // ==========================
  // Drag tickets
  // ==========================
  async function moveTicketToStatus(ticketId, status) {
    const t = (Array.isArray(tickets) ? tickets : []).find((x) => x._id === ticketId);
    if (!t) return;
    const current = t.status || "pendiente";
    if (current === status) return;

    setTickets((prev) =>
      (Array.isArray(prev) ? prev : []).map((x) => (x._id === ticketId ? { ...x, status } : x))
    );

    try {
      const updated = await api.setStatus(ticketId, status);
      setTickets((prev) =>
        (Array.isArray(prev) ? prev : []).map((x) => (x._id === updated._id ? updated : x))
      );
    } catch (err) {
      setTickets((prev) =>
        (Array.isArray(prev) ? prev : []).map((x) =>
          x._id === ticketId ? { ...x, status: current } : x
        )
      );
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
      const map = new Map((Array.isArray(prev) ? prev : []).map((t) => [t._id, t]));
      next.forEach((id, idx) => {
        const tt = map.get(id);
        if (tt) map.set(id, { ...tt, order: idx });
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

  async function bringTicketToTop(appId, statusKey, ticketId) {
  if (!appId || !statusKey || !ticketId) return;

  // 1) Orden local inmediato (para que en UI se vea arriba YA)
  setTickets((prev) => {
    const arr = Array.isArray(prev) ? prev : [];
    const same = arr.filter((t) => (t.status || "pendiente") === statusKey);
    const other = arr.filter((t) => (t.status || "pendiente") !== statusKey);

    const ids = same
      .slice()
      .sort((a, b) => {
        const ao = Number.isFinite(a.order) ? a.order : 0;
        const bo = Number.isFinite(b.order) ? b.order : 0;
        if (ao !== bo) return ao - bo;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      })
      .map((t) => t._id);

    // lo ponemos el primero
    const nextIds = [ticketId, ...ids.filter((id) => String(id) !== String(ticketId))];

    const map = new Map(arr.map((t) => [String(t._id), t]));
    nextIds.forEach((id, idx) => {
      const t = map.get(String(id));
      if (t) map.set(String(id), { ...t, order: idx });
    });

    // reconstruye: otros + misma columna con order actualizado
    const nextSame = nextIds.map((id) => map.get(String(id))).filter(Boolean);
    return [...other, ...nextSame];
  });

  // 2) Persistimos el orden en backend y refrescamos
  try {
    const arr = await api.listTickets(appId);
    const same = (Array.isArray(arr) ? arr : []).filter(
      (t) => (t.status || "pendiente") === statusKey
    );

    const ids = same
      .slice()
      .sort((a, b) => {
        const ao = Number.isFinite(a.order) ? a.order : 0;
        const bo = Number.isFinite(b.order) ? b.order : 0;
        if (ao !== bo) return ao - bo;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      })
      .map((t) => t._id);

    const nextIds = [ticketId, ...ids.filter((id) => String(id) !== String(ticketId))];

    await api.reorder(appId, statusKey, nextIds);
    await refreshTickets(appId);
  } catch (e) {
    console.error(e);
    await refreshTickets(appId);
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
      if (targetId && targetId !== ticketId) await reorderWithinStatus(statusKey, ticketId, targetId);
      return;
    }

    await moveTicketToStatus(ticketId, statusKey);
  }

  // ==========================
  // Drag apps
  // ==========================
  async function handleAppDragEnd(event) {
    const { active, over } = event;
    if (!active?.id) return;
    if (over?.id && over.id !== active.id) {
      try {
        const updated = await api.moveApp(String(active.id), String(over.id));
        setApps((prev) =>
          (Array.isArray(prev) ? prev : []).map((x) => (x._id === updated._id ? updated : x))
        );
      } catch (e) {
        console.error(e);
      }
    }
  }

  async function moveAppToRoot(app) {
    const updated = await api.moveApp(app._id, null);
    setApps((prev) =>
      (Array.isArray(prev) ? prev : []).map((x) => (x._id === updated._id ? updated : x))
    );
  }

  // ==========================
  // Modales apps
  // ==========================
  const [appActions, setAppActions] = useState({ open: false, app: null, mode: null, name: "" });

  function openRenameApp(app) {
    setAppActions({ open: true, app, mode: "rename", name: app.name });
  }
  function openDeleteApp(app) {
    setAppActions({ open: true, app, mode: "delete", name: app.name });
  }

  async function confirmAppAction() {
    if (!appActions.app) return;
    const app = appActions.app;

    if (appActions.mode === "rename") {
      const newName = String(appActions.name || "").trim();
      if (!newName) {
        showToast("El nombre no puede estar vacío.", "error", "modal");
        return;
      }
      showToast("Guardando nombre…", "info", "modal");
      const updated = await api.updateApp(app._id, newName);
      setApps((prev) =>
        (Array.isArray(prev) ? prev : []).map((x) => (x._id === updated._id ? updated : x))
      );
      showToast("✅ Nombre guardado", "ok", "modal");
    }

    if (appActions.mode === "delete") {
      const ok = confirm("¿Borrar esta aplicación, sus sub-apps y todos sus tickets? (No se puede deshacer)");
      if (!ok) return;
      showToast("Borrando aplicación…", "info", "modal");
      await api.deleteApp(app._id);
      const nextApps = appsArr.filter((x) => x._id !== app._id);
      setApps(nextApps);
      if (selectedAppId === app._id) {
        setSelectedAppId(nextApps[0]?._id || null);
        setSelectedTicketId(null);
        setTickets([]);
      }
      showToast("✅ Aplicación borrada", "ok", "modal");
    }

    setAppActions({ open: false, app: null, mode: null, name: "" });
  }

  async function createPerson() {
    const name = String(peopleModal.name || "").trim();
    const color = String(peopleModal.color || "").trim();
    if (!name) {
      showToast("Te falta el nombre de la persona.", "error", "modal");
      return;
    }

    showToast("Creando persona…", "info", "modal");

    try {
      await api.createPerson(name, color);
      setPeopleModal({ open: false, name: "", color: "" });
      await refreshPeople();
      showToast("✅ Persona creada", "ok", "modal");
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Error creando persona", "error", "modal");
    }
  }

  // ✅ ABRIR ticket + foco en Nueva nota
  function openTicket(t) {
    setSelectedTicketId(t._id);
    setEditingNote({ ticketId: null, noteId: null, text: "" });
    setEditingTitle({ ticketId: null, title: "" });
    setTicketModalOpen(true);

    // limpiamos toast modal
    setToast((prev) => ({ ...prev, open: false }));

    // ✅ foco a "Nueva nota"
    setTimeout(() => {
      noteInputRef.current?.focus?.();
    }, 50);
  }

  // PINTAR
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-3 md:p-4">
      {/* ✅ ancho real (sin hueco gigante). */}
      <div className="w-full max-w-none px-0 md:px-2">
        {/* Header */}
        <div className="mb-3 md:mb-4">
          {/* ✅ móvil: título normal */}
          <div className="md:hidden flex flex-col gap-3">
            {guideMobileOpen ? (
              <div className="rounded-2xl border bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Typography className="font-semibold text-blue-gray-900">
                      ¿Cómo funciona Tickets / Notas?
                    </Typography>
                    <Typography variant="small" className="text-gray-600">
                      Pulsa <b>Cerrar</b> si te molesta.
                    </Typography>
                  </div>

                  <button
                    type="button"
                    className="shrink-0 rounded-full bg-gray-100 hover:bg-gray-200 px-3 py-1 text-sm font-semibold text-gray-900"
                    onClick={() => setGuideMobileOpen(false)}
                  >
                    Cerrar
                  </button>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGuideTab("basico")}
                    className={[
                      "rounded-full px-3 py-1 text-sm font-semibold border transition",
                      guideTab === "basico"
                        ? "bg-blue-gray-900 text-white border-blue-gray-900"
                        : "bg-white text-blue-gray-900 border-gray-200 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    Pasos
                  </button>

                  <button
                    type="button"
                    onClick={() => setGuideTab("atajos")}
                    className={[
                      "rounded-full px-3 py-1 text-sm font-semibold border transition",
                      guideTab === "atajos"
                        ? "bg-blue-gray-900 text-white border-blue-gray-900"
                        : "bg-white text-blue-gray-900 border-gray-200 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    Atajos
                  </button>
                </div>

                {guideTab === "basico" ? (
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <div className="rounded-2xl border bg-gray-50 p-3">
                      <Typography className="font-semibold text-blue-gray-900">1) Crea una app</Typography>
                      <Typography variant="small" className="text-gray-600 mt-1">
                        Escribe el nombre y pulsa <b>Crear aplicación</b>.
                      </Typography>
                    </div>
                    <div className="rounded-2xl border bg-gray-50 p-3">
                      <Typography className="font-semibold text-blue-gray-900">2) Crea un ticket</Typography>
                      <Typography variant="small" className="text-gray-600 mt-1">
                        Rellena <b>Título</b> y elige quién lo <b>abre</b>.
                      </Typography>
                    </div>
                    <div className="rounded-2xl border bg-gray-50 p-3">
                      <Typography className="font-semibold text-blue-gray-900">3) Detalle</Typography>
                      <Typography variant="small" className="text-gray-600 mt-1">
                        Click en un ticket → editar título / notas / añadir nota.
                      </Typography>
                    </div>
                    <div className="rounded-2xl border bg-gray-50 p-3">
                      <Typography className="font-semibold text-blue-gray-900">4) Mover</Typography>
                      <Typography variant="small" className="text-gray-600 mt-1">
                        Arrastra para cambiar estado o prioridad.
                      </Typography>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border bg-gray-50 p-3">
                    <Typography className="font-semibold text-blue-gray-900">Tips</Typography>
                    <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
                      <li>Si falta Título o Abre, saldrá aviso debajo del bloque de crear ticket.</li>
                      <li>Responsable es opcional.</li>
                      <li>En el modal: “Aceptar” guarda ABRE/Responsable.</li>
                    </ul>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Typography variant="h4" className="text-blue-gray-900">
                  Tickets / Notas
                </Typography>
                <Typography variant="small" className="text-gray-600">
                  {selectedApp ? `App activa: ${selectedApp.name}` : "Crea o selecciona una aplicación"}
                </Typography>
              </div>

              {/* ✅ Hamburguesa guía (móvil) */}
              <button
                type="button"
                className="shrink-0 h-10 w-10 rounded-2xl border bg-white hover:bg-gray-50 text-xl leading-none"
                onClick={() => setGuideMobileOpen((v) => !v)}
                aria-label="Abrir ayuda"
                title="Cómo funciona"
              >
                ☰
              </button>
            </div>

            {/* Mobile selector */}
            <div>
              <select
                className="w-full rounded-2xl border bg-white px-3 py-3 text-sm"
                value={selectedAppId || ""}
                onChange={(e) => setSelectedAppId(e.target.value || null)}
              >
                <option value="">Selecciona app…</option>
                {flattenedApps.map((a) => (
                  <option key={a._id} value={a._id}>
                    {`${"—".repeat(a.depth)}${a.depth ? " " : ""}${a.name}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ✅ desktop: MISMA REJILLA que el layout (4 / 8) */}
          <div className="hidden md:grid md:grid-cols-12 md:gap-4">
            {/* Izquierda = mismo ancho que “Aplicaciones” */}
            <div className="md:col-span-4 md:pl-1">
              <Typography variant="h4" className="text-blue-gray-900">
                Tickets / Notas
              </Typography>
              <Typography variant="small" className="text-gray-600">
                {selectedApp ? `App activa: ${selectedApp.name}` : "Crea o selecciona una aplicación"}
              </Typography>
            </div>

            {/* Derecha = mismo ancho que “Tablero” */}
            <div className="md:col-span-8">
              <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Typography className="font-semibold text-blue-gray-900 text-base">
                      ¿Cómo funciona Tickets / Notas?
                    </Typography>
                    <Typography variant="small" className="text-gray-600">
                      Dale a <span className="text-red-500 font-bold">"ocultar"</span> si te moleta este panel de ayuda y si quieres verlo dale a{" "}
                      <span className="text-green-500 font-bold">"ver"</span>
                    </Typography>
                  </div>

                  <button
                    type="button"
                    className="shrink-0 rounded-full bg-gray-100 hover:bg-gray-200 px-3 py-1 text-sm font-semibold text-gray-900"
                    onClick={() => setGuideOpen((v) => !v)}
                  >
                    {guideOpen ? "Ocultar" : "Ver"}
                  </button>
                </div>

                {guideOpen ? (
                  <div className="mt-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setGuideTab("basico")}
                        className={[
                          "rounded-full px-3 py-1 text-sm font-semibold border transition",
                          guideTab === "basico"
                            ? "bg-blue-gray-900 text-white border-blue-gray-900"
                            : "bg-white text-blue-gray-900 border-gray-200 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        Pasos
                      </button>

                      <button
                        type="button"
                        onClick={() => setGuideTab("atajos")}
                        className={[
                          "rounded-full px-3 py-1 text-sm font-semibold border transition",
                          guideTab === "atajos"
                            ? "bg-blue-gray-900 text-white border-blue-gray-900"
                            : "bg-white text-blue-gray-900 border-gray-200 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        Atajos
                      </button>
                    </div>

                    {guideTab === "basico" ? (
                      <div className="mt-3 grid grid-cols-4 gap-3">
                        <div className="rounded-2xl border bg-gray-50 p-4">
                          <Typography className="font-semibold text-blue-gray-900">1) Crea una app</Typography>
                          <Typography variant="small" className="text-gray-600 mt-1">
                            Escribe el nombre y pulsa <b>Crear aplicación</b> al crear una nueva.
                          </Typography>
                        </div>
                        <div className="rounded-2xl border bg-gray-50 p-4">
                          <Typography className="font-semibold text-blue-gray-900">2) Crea un ticket</Typography>
                          <Typography variant="small" className="text-gray-600 mt-1">
                            Rellena <b>Título</b> y pon quien lo <b>crea</b> (obligatorio).
                          </Typography>
                        </div>
                        <div className="rounded-2xl border bg-gray-50 p-4">
                          <Typography className="font-semibold text-blue-gray-900">3) Detalle</Typography>
                          <Typography variant="small" className="text-gray-600 mt-1">
                            Click en un ticket → Puedes editar título y notas y añadir nuevas notas.
                          </Typography>
                        </div>
                        <div className="rounded-2xl border bg-gray-50 p-4">
                          <Typography className="font-semibold text-blue-gray-900">4) Mover</Typography>
                          <Typography variant="small" className="text-gray-600 mt-1">
                            Arrastra para cambiar de estado o prioridad.
                          </Typography>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border bg-gray-50 p-4">
                        <Typography className="font-semibold text-blue-gray-900">Tips</Typography>
                        <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
                          <li>Si falta Título o nos e pone la persona que lo abre, te saldrá aviso debajo del bloque de crear ticket.</li>
                          <li>El responsable es opcional.</li>
                          <li>Dentro del detalles del tickets: dale “Aceptar” para guarda</li>
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Layout desktop */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
          {/* Apps */}
          <Card className="hidden md:block md:col-span-3 shadow-sm rounded-2xl">
            <CardBody>
              <div className="flex items-center justify-between">
                <Typography variant="h6" className="text-blue-gray-900">
                  Aplicaciones
                </Typography>
                <span className="text-xs rounded-full bg-blue-gray-50 px-2 py-1 text-blue-gray-700">
                  {appsArr.length}
                </span>
              </div>

              <div className="mt-3">
                <Input
                  label="Nueva app"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                />
                <button
                  type="button"
                  className="mt-2 w-full rounded-xl bg-blue-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={creatingApp}
                  onClick={onCreateApp}
                >
                  {creatingApp ? "Creando…" : "Crear aplicación"}
                </button>

                <InlineToast
                  show={toast.open && toast.where === "app"}
                  msg={toast.msg}
                  type={toast.type}
                />
              </div>

              <div className="mt-4 max-h-[76vh] overflow-auto rounded-2xl border bg-white">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleAppDragEnd}
                >
                  <List>
                    {flattenedApps.map((a) => (
                      <AppRow
                        key={a._id}
                        app={a}
                        depth={a.depth}
                        active={selectedAppId === a._id}
                        onSelect={(id) => setSelectedAppId(id)}
                        onRename={openRenameApp}
                        onDelete={openDeleteApp}
                        onMoveRoot={moveAppToRoot}
                      />
                    ))}
                    {appsArr.length === 0 ? (
                      <Typography className="p-3 text-gray-600">
                        Crea tu primera aplicación.
                      </Typography>
                    ) : null}
                  </List>
                </DndContext>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <Typography variant="small" className="text-gray-600">
                  Arrastra (⋮⋮) encima de otra app para anidarla.
                </Typography>
                <button
                  className="text-xs px-3 py-2 rounded-full bg-gray-100 hover:bg-gray-200"
                  onClick={() => setPeopleModal((p) => ({ ...p, open: true }))}
                  type="button"
                >
                  Personas
                </button>
              </div>
            </CardBody>
          </Card>

          {/* Board */}
          <Card className="md:col-span-9 shadow-sm rounded-2xl">
            <CardBody>
              <div className="flex items-center justify-between">
                <Typography variant="h6" className="text-blue-gray-900">
                  Tablero
                </Typography>
                <span className="text-xs rounded-full bg-blue-gray-50 px-2 py-1 text-blue-gray-700">
                  {(Array.isArray(tickets) ? tickets : []).length} tickets
                </span>
              </div>

              {/* Crear ticket */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-2">
                <div className="md:col-span-5">
                  <Input
                    label="Título del ticket"
                    value={ticketTitle}
                    onChange={(e) => setTicketTitle(e.target.value)}
                    disabled={!selectedAppId}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                  />
                </div>

                <div className="md:col-span-3">
                  <select
                    className="w-full rounded-xl border bg-white px-3 py-3 text-sm"
                    value={newCreatedBy}
                    onChange={(e) => setNewCreatedBy(e.target.value)}
                    disabled={!selectedAppId}
                  >
                    <option value="">Abre (obligatorio)…</option>
                    {people.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <select
                    className="w-full rounded-xl border bg-white px-3 py-3 text-sm"
                    value={newAssignedTo}
                    onChange={(e) => setNewAssignedTo(e.target.value)}
                    disabled={!selectedAppId}
                  >
                    <option value="">Responsable (opcional)…</option>
                    {people.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-1">
                  <button
                    type="button"
                    className="w-full rounded-xl bg-blue-gray-900 py-3 text-sm font-semibold text-white hover:bg-blue-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={creatingTicket}
                    onClick={onCreateTicket}
                  >
                    {creatingTicket ? "Creando…" : "Crear"}
                  </button>
                </div>

                <div className="md:col-span-12">
                  <InlineToast
                    show={toast.open && toast.where === "ticket"}
                    msg={toast.msg}
                    type={toast.type}
                  />
                </div>
              </div>

              <Typography variant="small" className="mt-3 text-gray-500 leading-5 hidden md:block">
                Click en un ticket = ver/editar. Drag entre columnas = estado. Drag dentro = prioridad.
              </Typography>
              <Typography variant="small" className="mt-1 text-gray-600">
                App: <b>{appDisplayName(selectedApp, appsArr)}</b>
              </Typography>

              {/* Columns */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                {STATUS.map((s) => {
                  const cx = accentClasses(s.accent);
                  const isOver = dragOverStatus === s.key;

                  return (
                    <div
                      key={s.key}
                      className={[
                        "rounded-2xl border bg-white overflow-hidden",
                        isOver ? "ring-2 ring-blue-gray-200" : "",
                      ].join(" ")}
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

                      <div className="max-h-[70vh] overflow-auto p-2 bg-gradient-to-b from-white to-gray-50">
                        {ticketsByStatus[s.key].map((t, idx) => {
                          const lastNote = (t.notes || []).slice(-1)[0]?.text || "";
                          const created = t.createdBy ? peopleById.get(String(t.createdBy)) : null;
                          const assigned = t.assignedTo ? peopleById.get(String(t.assignedTo)) : null;

                          return (
                            <div
                              key={t._id}
                              draggable
                              onDragStart={(e) => onDragStartTicket(e, t._id, s.key)}
                              onDragEnd={onDragEndTicket}
                              onDragEnter={(e) => onDragEnterTicket(e, t._id, s.key)}
                              onClick={() => openTicket(t)}
                              className={[
                                "rounded-xl border p-3 mb-2 shadow-sm transition cursor-pointer bg-white",
                                cx.hover,
                                dragOverTicketId === t._id &&
                                dragRef.current.ticketId &&
                                dragRef.current.fromStatus === s.key &&
                                dragRef.current.ticketId !== t._id
                                  ? "ring-2 ring-blue-gray-100"
                                  : "",
                              ].join(" ")}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <Typography className="font-semibold text-blue-gray-900 break-words leading-5">
                                  {t.title}
                                </Typography>
                                <span className="text-xs rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                                  #{idx + 1}
                                </span>
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {created ? (
                                  <span
                                    className="text-xs rounded-full px-2 py-1 border bg-white"
                                    title={`Abre: ${created.name}`}
                                    style={created.color ? { borderColor: created.color } : undefined}
                                  >
                                    A: {initials(created.name)}
                                  </span>
                                ) : null}
                                {assigned ? (
                                  <span
                                    className="text-xs rounded-full px-2 py-1 border bg-white"
                                    title={`Responsable: ${assigned.name}`}
                                    style={assigned.color ? { borderColor: assigned.color } : undefined}
                                  >
                                    R: {initials(assigned.name)}
                                  </span>
                                ) : null}
                                <span className="text-xs rounded-full bg-gray-50 px-2 py-1 text-gray-700">
                                  {t.notes?.length || 0} notas
                                </span>
                              </div>

                              {lastNote ? (
                                <Typography variant="small" className="mt-2 text-gray-600 break-words leading-5">
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

                        {ticketsByStatus[s.key].length === 0 ? (
                          <div className="rounded-xl border border-dashed bg-white/80 p-4">
                            <Typography className="text-gray-600">Vacío.</Typography>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Ticket modal */}
      <Modal
        open={ticketModalOpen && !!selectedTicket}
        title="Detalle del ticket"
        onClose={() => setTicketModalOpen(false)}
        footer={
          !selectedTicket ? null : (
            <div>
              <InlineToast
                show={toast.open && toast.where === "modal"}
                msg={toast.msg}
                type={toast.type}
              />

              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-2xl py-3 font-semibold shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#059669", color: "#ffffff" }}
                  disabled={savingTicketPeople}
                  onClick={() => saveTicketPeople(selectedTicket)}
                >
                  {savingTicketPeople ? "Guardando…" : "Aceptar"}
                </button>

                <button
                  type="button"
                  className="flex-1 rounded-2xl border border-red-200 text-red-700 py-3 font-semibold hover:bg-red-50 active:scale-[0.99] transition"
                  onClick={() => deleteTicket(selectedTicket._id)}
                >
                  Borrar ticket
                </button>
              </div>
            </div>
          )
        }
      >
        {!selectedTicket ? null : (
          <>
            {/* Título + botón Modificar */}
            <div className="rounded-2xl border bg-white p-3">
              {editingTitle.ticketId === selectedTicket._id ? (
                <div>
                  <Input
                    label="Nuevo título"
                    value={editingTitle.title}
                    onChange={(e) => setEditingTitle((prev) => ({ ...prev, title: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                      if (e.key === "Escape") setEditingTitle({ ticketId: null, title: "" });
                    }}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-xl bg-blue-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-blue-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={!editingTitle.title.trim() || savingTitle}
                      onClick={saveEditedTitle}
                    >
                      {savingTitle ? "Guardando…" : "Guardar"}
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-200"
                      onClick={() => setEditingTitle({ ticketId: null, title: "" })}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <Typography className="font-semibold text-blue-gray-900 break-words leading-5">
                    {selectedTicket.title}
                  </Typography>
                  <button
                    type="button"
                    className="shrink-0 rounded-full bg-gray-100 hover:bg-gray-200 px-3 py-1 text-sm font-semibold text-gray-900"
                    onClick={() =>
                      setEditingTitle({ ticketId: selectedTicket._id, title: selectedTicket.title })
                    }
                    title="Modificar título"
                  >
                    Modificar
                  </button>
                </div>
              )}

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                <select
                  className="w-full rounded-xl border bg-white px-3 py-3 text-sm"
                  value={selectedTicket.createdBy || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTickets((prev) =>
                      (Array.isArray(prev) ? prev : []).map((t) =>
                        t._id === selectedTicket._id ? { ...t, createdBy: v } : t
                      )
                    );
                  }}
                >
                  <option value="">Abre (obligatorio)…</option>
                  {people.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <select
                  className="w-full rounded-xl border bg-white px-3 py-3 text-sm"
                  value={selectedTicket.assignedTo || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTickets((prev) =>
                      (Array.isArray(prev) ? prev : []).map((t) =>
                        t._id === selectedTicket._id ? { ...t, assignedTo: v } : t
                      )
                    );
                  }}
                >
                  <option value="">Responsable (opcional)…</option>
                  {people.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <Typography variant="small" className="mt-3 text-gray-600">
                Notas: botón para añadir. Click en una nota para editar.
              </Typography>
            </div>

            {/* Añadir nota */}
            <div className="mt-3">
              <Textarea
                label=""
                placeholder="Nueva nota"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                inputRef={noteInputRef}
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-blue-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-blue-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={addingNote}
                  onClick={onAddNote}
                >
                  {addingNote ? "Añadiendo…" : "Añadir nota"}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-200"
                  onClick={() => setNoteText("")}
                  disabled={!noteText}
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Lista notas */}
            <div className="mt-3 space-y-3">
              {(selectedTicket.notes || [])
                .slice()
                .reverse()
                .map((n) => {
                  const isEditing =
                    editingNote.ticketId === selectedTicket._id &&
                    editingNote.noteId === n._id;

                  return (
                    <div
                      key={n._id}
                      className="rounded-2xl border bg-white p-3 shadow-sm"
                      onClick={() =>
                        setEditingNote({
                          ticketId: selectedTicket._id,
                          noteId: n._id,
                          text: n.text,
                        })
                      }
                      title="Click para editar"
                    >
                      {!isEditing ? (
                        <>
                          <Typography className="whitespace-pre-wrap break-words text-blue-gray-900">
                            {n.text}
                          </Typography>
                          <Typography variant="small" className="mt-2 text-gray-600">
                            {formatDate(n.at)}
                          </Typography>
                        </>
                      ) : (
                        <>
                          <Textarea
                            label=""
                            placeholder="Editando nota"
                            value={editingNote.text}
                            onChange={(e) =>
                              setEditingNote((prev) => ({
                                ...prev,
                                text: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Escape")
                                setEditingNote({
                                  ticketId: null,
                                  noteId: null,
                                  text: "",
                                });
                            }}
                          />

                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-xl bg-blue-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                              disabled={savingNote}
                              onClick={(e) => {
                                e.stopPropagation();
                                saveEditedNote();
                              }}
                            >
                              {savingNote ? "Guardando…" : "Guardar"}
                            </button>

                            <button
                              type="button"
                              className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingNote({ ticketId: null, noteId: null, text: "" });
                              }}
                            >
                              Cancelar
                            </button>

                            <button
                              type="button"
                              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNote(selectedTicket._id, n._id);
                              }}
                            >
                              Borrar
                            </button>
                          </div>

                          <Typography variant="small" className="mt-2 text-gray-600">
                            {formatDate(n.at)}
                          </Typography>
                        </>
                      )}
                    </div>
                  );
                })}

              {(selectedTicket.notes || []).length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-white p-4">
                  <Typography className="text-gray-600">Aún no hay notas.</Typography>
                </div>
              ) : null}
            </div>
          </>
        )}
      </Modal>

      {/* People modal */}
      <Modal
        open={peopleModal.open}
        title="Personas"
        onClose={() => setPeopleModal({ open: false, name: "", color: "" })}
        footer={
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-xl bg-blue-gray-900 text-white py-3 font-semibold hover:bg-blue-gray-800 active:scale-[0.99] transition"
              onClick={createPerson}
              type="button"
            >
              Añadir
            </button>
            <button
              className="flex-1 rounded-xl bg-gray-100 py-3 font-semibold hover:bg-gray-200 active:scale-[0.99] transition text-gray-900"
              onClick={() => setPeopleModal({ open: false, name: "", color: "" })}
              type="button"
            >
              Cerrar
            </button>
          </div>
        }
      >
        <InlineToast
          show={toast.open && toast.where === "modal"}
          msg={toast.msg}
          type={toast.type}
        />

        <Typography className="text-gray-700">
          Añade personas por nombre. El color es opcional (ej: #328077).
        </Typography>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="md:col-span-2">
            <Input
              label="Nombre (obligatorio)"
              value={peopleModal.name}
              onChange={(e) => setPeopleModal((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="md:col-span-1">
            <Input
              label="Color (opcional)"
              value={peopleModal.color}
              onChange={(e) => setPeopleModal((p) => ({ ...p, color: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border bg-white p-3">
          <Typography variant="small" className="text-gray-600 mb-2">
            Lista
          </Typography>
          <div className="flex flex-wrap gap-2">
            {people.map((p) => (
              <span
                key={p._id}
                className="text-xs rounded-full px-2 py-1 border bg-white"
                style={p.color ? { borderColor: p.color } : undefined}
                title={p.name}
              >
                {p.name}
              </span>
            ))}
            {people.length === 0 ? (
              <Typography className="text-gray-600">Aún no hay personas.</Typography>
            ) : null}
          </div>
        </div>
      </Modal>

      {/* Rename app modal */}
      <Modal
        open={appActions.open && appActions.mode === "rename"}
        title="Renombrar aplicación"
        onClose={() => setAppActions({ open: false, app: null, mode: null, name: "" })}
        footer={
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-xl bg-blue-gray-900 text-white py-3 font-semibold hover:bg-blue-gray-800 active:scale-[0.99] transition"
              onClick={confirmAppAction}
              type="button"
            >
              Guardar
            </button>
            <button
              className="flex-1 rounded-xl bg-gray-100 py-3 font-semibold hover:bg-gray-200 active:scale-[0.99] transition text-gray-900"
              onClick={() => setAppActions({ open: false, app: null, mode: null, name: "" })}
              type="button"
            >
              Cancelar
            </button>
          </div>
        }
      >
        <InlineToast
          show={toast.open && toast.where === "modal"}
          msg={toast.msg}
          type={toast.type}
        />

        <Typography className="text-gray-700">
          Nuevo nombre para <b>{appActions.app?.name}</b>
        </Typography>
        <div className="mt-3">
          <Input
            label="Nombre"
            value={appActions.name}
            onChange={(e) => setAppActions((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Delete app modal */}
      <Modal
        open={appActions.open && appActions.mode === "delete"}
        title="Borrar aplicación"
        onClose={() => setAppActions({ open: false, app: null, mode: null, name: "" })}
        footer={
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-xl bg-red-600 text-white py-3 font-semibold hover:bg-red-700 active:scale-[0.99] transition"
              onClick={confirmAppAction}
              type="button"
            >
              Borrar
            </button>
            <button
              className="flex-1 rounded-xl bg-gray-100 py-3 font-semibold hover:bg-gray-200 active:scale-[0.99] transition text-gray-900"
              onClick={() => setAppActions({ open: false, app: null, mode: null, name: "" })}
              type="button"
            >
              Cancelar
            </button>
          </div>
        }
      >
        <InlineToast
          show={toast.open && toast.where === "modal"}
          msg={toast.msg}
          type={toast.type}
        />

        <Typography className="text-gray-700">
          Vas a borrar <b>{appActions.app?.name}</b>, sus sub-apps y <b>todos sus tickets</b>. Esta acción no se puede deshacer.
        </Typography>
      </Modal>
    </div>
  );
}