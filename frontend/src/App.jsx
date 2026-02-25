import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardBody, Typography, Input, List, ListItem, Textarea } from '@material-tailwind/react';
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, closestCenter } from '@dnd-kit/core';
import { api } from './api';

const STATUS = [
  { key: 'pendiente', label: 'Pendiente', accent: 'amber' },
  { key: 'en_curso', label: 'En curso', accent: 'blue' },
  { key: 'hecho', label: 'Hecho', accent: 'emerald' },
];

function formatDate(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return '';
  }
}

function accentClasses(accent) {
  switch (accent) {
    case 'amber':
      return { header: 'bg-amber-50 border-amber-100', pill: 'bg-amber-100 text-amber-800', hover: 'hover:border-amber-200' };
    case 'blue':
      return { header: 'bg-blue-50 border-blue-100', pill: 'bg-blue-100 text-blue-800', hover: 'hover:border-blue-200' };
    case 'emerald':
      return { header: 'bg-emerald-50 border-emerald-100', pill: 'bg-emerald-100 text-emerald-800', hover: 'hover:border-emerald-200' };
    default:
      return { header: 'bg-blue-gray-50 border-blue-gray-100', pill: 'bg-blue-gray-100 text-blue-gray-800', hover: 'hover:border-blue-gray-200' };
  }
}

function firstLine(text = '') {
  const t = String(text || '').trim();
  if (!t) return '';
  return t.split('\n')[0].slice(0, 80);
}

function initials(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || '';
  const b = parts[1]?.[0] || '';
  return (a + b).toUpperCase();
}

function appDisplayName(app, appsArr) {
  if (!app) return '—';
  const parent = app.parentId ? appsArr.find((a) => String(a._id) === String(app.parentId)) : null;
  return parent ? `${app.name} (${parent.name})` : app.name;
}

function buildAppTree(appsArr) {
  const byId = new Map(appsArr.map((a) => [String(a._id), { ...a, children: [] }]));
  const roots = [];
  for (const a of byId.values()) {
    const pid = a.parentId ? String(a.parentId) : null;
    if (pid && byId.has(pid)) byId.get(pid).children.push(a);
    else roots.push(a);
  }
  const sortRec = (nodes) => {
    nodes.sort((x, y) => (x.order ?? 0) - (y.order ?? 0) || new Date(x.createdAt) - new Date(y.createdAt));
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

function Modal({ open, title, children, footer, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative w-full md:w-[560px] h-[88vh] md:h-auto md:max-h-[88vh] rounded-t-3xl md:rounded-3xl bg-white shadow-xl border overflow-hidden">
        <div className="sticky top-0 z-20 p-3 md:p-4 border-b bg-white flex items-center justify-between">
          <Typography variant="h6" className="text-blue-gray-900">{title}</Typography>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-sm"
            type="button"
          >
            Cerrar
          </button>
        </div>

        <div className="h-full overflow-auto p-3 md:p-4 pb-28">
          {children}
        </div>

        {footer ? (
          <div className="sticky bottom-0 z-20 border-t bg-white p-3 md:p-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ActionBtn({ title, onClick, children, variant = 'neutral' }) {
  const base = 'h-8 w-8 grid place-items-center rounded-full border text-xs font-semibold transition active:scale-[0.98]';
  const styles = {
    neutral: 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50',
    danger: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100',
    primary: 'bg-blue-gray-900 border-blue-gray-900 text-white hover:bg-blue-gray-800',
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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: String(app._id) });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: String(app._id) });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div ref={setDropRef}>
      <ListItem
        ref={setNodeRef}
        style={style}
        onClick={() => onSelect(app._id)}
        className={[
          'transition rounded-xl flex items-center justify-between gap-2',
          'py-2 px-2',
          active ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50',
          isOver ? 'ring-2 ring-blue-gray-100' : '',
          isDragging ? 'opacity-70' : '',
        ].join(' ')}
      >
        <div className="min-w-0 flex-1 pr-2" style={{ paddingLeft: `${depth * 14}px` }}>
          <Typography className="font-semibold text-blue-gray-900 truncate">{app.name}</Typography>
          <Typography variant="small" className="text-gray-600 truncate">{formatDate(app.createdAt)}</Typography>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {app.parentId ? (
            <ActionBtn title="Mover a raíz" onClick={(e) => { e.stopPropagation(); onMoveRoot(app); }}>
              ↑
            </ActionBtn>
          ) : null}

          <ActionBtn title="Editar nombre" onClick={(e) => { e.stopPropagation(); onRename(app); }}>
            ✎
          </ActionBtn>

          <ActionBtn title="Borrar aplicación" variant="danger" onClick={(e) => { e.stopPropagation(); onDelete(app); }}>
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
  const [appName, setAppName] = useState('');
  const [selectedAppId, setSelectedAppId] = useState(null);

  const [people, setPeople] = useState([]);
  const [peopleModal, setPeopleModal] = useState({ open: false, name: '', color: '' });

  const [tickets, setTickets] = useState([]);
  const [ticketTitle, setTicketTitle] = useState('');
  const [newCreatedBy, setNewCreatedBy] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState('');

  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [noteText, setNoteText] = useState('');

  const [editingTitle, setEditingTitle] = useState({ ticketId: null, title: '' });
  const [editingNote, setEditingNote] = useState({ ticketId: null, noteId: null, text: '' });

  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [savingTicket, setSavingTicket] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  // Drag tickets (HTML5)
  const dragRef = useRef({ ticketId: null, fromStatus: null });
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const [dragOverTicketId, setDragOverTicketId] = useState(null);

  // DnD apps
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const appsArr = Array.isArray(apps) ? apps : [];
  const selectedTicket = useMemo(() => (Array.isArray(tickets) ? tickets : []).find((t) => t._id === selectedTicketId) || null, [tickets, selectedTicketId]);
  const selectedApp = useMemo(() => appsArr.find((a) => a._id === selectedAppId) || null, [appsArr, selectedAppId]);

  const appTree = useMemo(() => buildAppTree(appsArr), [appsArr]);
  const flattenedApps = useMemo(() => flattenAppTree(appTree), [appTree]);

  const peopleById = useMemo(() => {
    const m = new Map();
    for (const p of people) m.set(String(p._id), p);
    return m;
  }, [people]);

  const ticketsByStatus = useMemo(() => {
    const map = { pendiente: [], en_curso: [], hecho: [] };
    for (const t of (Array.isArray(tickets) ? tickets : [])) map[t.status || 'pendiente'].push(t);

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

  async function onCreateApp(e) {
    e.preventDefault();
    if (!appName.trim()) return;
    await api.createApp(appName.trim(), null);
    setAppName('');
    await refreshApps();
  }

  async function onCreateTicket(e) {
    e.preventDefault();
    if (!selectedAppId || !ticketTitle.trim()) return;
    if (!newCreatedBy) {
      alert('Selecciona quién ABRE el ticket.');
      return;
    }
    await api.createTicket(selectedAppId, ticketTitle.trim(), newCreatedBy, newAssignedTo || null);
    setTicketTitle('');
    setNewAssignedTo('');
    await refreshTickets(selectedAppId);
  }

  async function onAddNote(e) {
    e.preventDefault();
    if (!selectedTicketId || !noteText.trim()) return;
    const updated = await api.addNote(selectedTicketId, noteText.trim());
    setNoteText('');
    setTickets((prev) => (Array.isArray(prev) ? prev : []).map((t) => (t._id === updated._id ? updated : t)));
  }

  async function saveEditedTitle() {
    const { ticketId, title } = editingTitle;
    if (!ticketId || !title.trim()) return;
    const updated = await api.updateTitle(ticketId, title.trim());
    setTickets((prev) => (Array.isArray(prev) ? prev : []).map((t) => (t._id === updated._id ? updated : t)));
    setEditingTitle({ ticketId: null, title: '' });
  }

  async function saveEditedNote() {
    const { ticketId, noteId, text } = editingNote;
    if (!ticketId || !noteId || !text.trim()) return;
    const updated = await api.updateNote(ticketId, noteId, text.trim());
    setTickets((prev) => (Array.isArray(prev) ? prev : []).map((t) => (t._id === updated._id ? updated : t)));
    setEditingNote({ ticketId: null, noteId: null, text: '' });
  }

  async function deleteNote(ticketId, noteId) {
    const updated = await api.deleteNote(ticketId, noteId);
    setTickets((prev) => (Array.isArray(prev) ? prev : []).map((t) => (t._id === updated._id ? updated : t)));
    setEditingNote({ ticketId: null, noteId: null, text: '' });
  }

  async function deleteTicket(ticketId) {
    const ok = confirm('¿Borrar este ticket y todas sus notas? (No se puede deshacer)');
    if (!ok) return;
    await api.deleteTicket(ticketId);
    setTickets((prev) => (Array.isArray(prev) ? prev : []).filter((t) => t._id !== ticketId));
    setSelectedTicketId(null);
    setTicketModalOpen(false);
  }

  async function saveTicketPeople(ticket) {
    if (!ticket?.createdBy) {
      alert('El campo ABRE es obligatorio.');
      return;
    }
    const updated = await api.updateTicketPeople(ticket._id, ticket.createdBy, ticket.assignedTo || null);
    setTickets((prev) => (Array.isArray(prev) ? prev : []).map((t) => (t._id === updated._id ? updated : t)));
  }

  // Drag tickets
  async function moveTicketToStatus(ticketId, status) {
    const t = (Array.isArray(tickets) ? tickets : []).find((x) => x._id === ticketId);
    if (!t) return;
    const current = t.status || 'pendiente';
    if (current === status) return;

    setTickets((prev) => (Array.isArray(prev) ? prev : []).map((x) => (x._id === ticketId ? { ...x, status } : x)));

    try {
      const updated = await api.setStatus(ticketId, status);
      setTickets((prev) => (Array.isArray(prev) ? prev : []).map((x) => (x._id === updated._id ? updated : x)));
    } catch (err) {
      setTickets((prev) => (Array.isArray(prev) ? prev : []).map((x) => (x._id === ticketId ? { ...x, status: current } : x)));
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

  function onDragStartTicket(e, ticketId, statusKey) {
    dragRef.current = { ticketId, fromStatus: statusKey };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ticketId);
  }

  function onDragEndTicket() {
    dragRef.current = { ticketId: null, fromStatus: null };
    setDragOverStatus(null);
    setDragOverTicketId(null);
  }

  function onDragOverColumn(e, statusKey) {
    e.preventDefault();
    setDragOverStatus(statusKey);
    e.dataTransfer.dropEffect = 'move';
  }

  function onDragEnterTicket(_e, ticketId, statusKey) {
    if (dragRef.current.ticketId && dragRef.current.fromStatus === statusKey) {
      setDragOverTicketId(ticketId);
    }
  }

  async function onDropColumn(e, statusKey) {
    e.preventDefault();

    const ticketId = dragRef.current.ticketId || e.dataTransfer.getData('text/plain');
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

  // Drag apps (nesting)
  async function handleAppDragEnd(event) {
    const { active, over } = event;
    if (!active?.id) return;
    if (over?.id && over.id !== active.id) {
      try {
        const updated = await api.moveApp(String(active.id), String(over.id));
        setApps((prev) => (Array.isArray(prev) ? prev : []).map((x) => (x._id === updated._id ? updated : x)));
      } catch (e) {
        console.error(e);
      }
    }
  }

  async function moveAppToRoot(app) {
    const updated = await api.moveApp(app._id, null);
    setApps((prev) => (Array.isArray(prev) ? prev : []).map((x) => (x._id === updated._id ? updated : x)));
  }

  // App actions
  const [appActions, setAppActions] = useState({ open: false, app: null, mode: null, name: '' });

  function openRenameApp(app) {
    setAppActions({ open: true, app, mode: 'rename', name: app.name });
  }
  function openDeleteApp(app) {
    setAppActions({ open: true, app, mode: 'delete', name: app.name });
  }

  async function confirmAppAction() {
    if (!appActions.app) return;
    const app = appActions.app;

    if (appActions.mode === 'rename') {
      const newName = appActions.name.trim();
      if (!newName) return;
      const updated = await api.updateApp(app._id, newName);
      setApps((prev) => (Array.isArray(prev) ? prev : []).map((x) => (x._id === updated._id ? updated : x)));
    }

    if (appActions.mode === 'delete') {
      const ok = confirm('¿Borrar esta aplicación, sus sub-apps y todos sus tickets? (No se puede deshacer)');
      if (!ok) return;
      await api.deleteApp(app._id);
      const nextApps = (Array.isArray(appsArr) ? appsArr : []).filter((x) => x._id !== app._id);
      setApps(nextApps);
      if (selectedAppId === app._id) {
        setSelectedAppId(nextApps[0]?._id || null);
        setSelectedTicketId(null);
        setTickets([]);
      }
    }

    setAppActions({ open: false, app: null, mode: null, name: '' });
  }

  async function createPerson() {
    if (!peopleModal.name.trim()) return;
    const p = await api.createPerson(peopleModal.name.trim(), peopleModal.color.trim());
    setPeople((prev) => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)));
    setPeopleModal({ open: false, name: '', color: '' });
  }

  function openTicket(t) {
    setSelectedTicketId(t._id);
    setEditingNote({ ticketId: null, noteId: null, text: '' });
    setEditingTitle({ ticketId: null, title: '' });
    setTicketModalOpen(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-3 md:p-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 md:mb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-2">
          <div>
            <Typography variant="h4" className="text-blue-gray-900">Tickets / Notas</Typography>
            <Typography variant="small" className="text-gray-600">
              {selectedApp ? `App activa: ${selectedApp.name}` : 'Crea o selecciona una aplicación'}
            </Typography>
          </div>

          <div className="md:hidden">
            <select
              className="w-full rounded-2xl border bg-white px-3 py-3 text-sm"
              value={selectedAppId || ''}
              onChange={(e) => setSelectedAppId(e.target.value || null)}
            >
              <option value="">Selecciona app…</option>
              {flattenedApps.map((a) => (
                <option key={a._id} value={a._id}>
                  {`${'—'.repeat(a.depth)}${a.depth ? ' ' : ''}${a.name}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
          <Card className="hidden md:block md:col-span-3 shadow-sm rounded-2xl">
            <CardBody>
              <div className="flex items-center justify-between">
                <Typography variant="h6" className="text-blue-gray-900">Aplicaciones</Typography>
                <span className="text-xs rounded-full bg-blue-gray-50 px-2 py-1 text-blue-gray-700">{appsArr.length}</span>
              </div>

              <form className="mt-3" onSubmit={onCreateApp}>
                <Input label="Nueva app (Enter)" value={appName} onChange={(e) => setAppName(e.target.value)} />
                <button type="submit" className="hidden" aria-hidden="true" />
              </form>

              <div className="mt-4 max-h-[65vh] overflow-auto rounded-2xl border bg-white">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleAppDragEnd}>
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
                    {appsArr.length === 0 && <Typography className="p-3 text-gray-600">Crea tu primera aplicación.</Typography>}
                  </List>
                </DndContext>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <Typography variant="small" className="text-gray-600">Arrastra (⋮⋮) encima de otra app para anidarla.</Typography>
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

          <Card className="md:col-span-9 shadow-sm rounded-2xl">
            <CardBody>
              <div className="flex items-center justify-between">
                <Typography variant="h6" className="text-blue-gray-900">Tablero</Typography>
                <span className="text-xs rounded-full bg-blue-gray-50 px-2 py-1 text-blue-gray-700">{tickets.length} tickets</span>
              </div>

              <form className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-2" onSubmit={onCreateTicket}>
                <div className="md:col-span-6">
                  <Input
                    label="Título del ticket (Enter)"
                    value={ticketTitle}
                    onChange={(e) => setTicketTitle(e.target.value)}
                    disabled={!selectedAppId}
                  />
                </div>

                <div className="md:col-span-3">
                  <select
                    className="w-full rounded-2xl border bg-white px-3 py-3 text-sm"
                    value={newCreatedBy}
                    onChange={(e) => setNewCreatedBy(e.target.value)}
                    disabled={!selectedAppId}
                  >
                    <option value="">Abre (obligatorio)…</option>
                    {people.map((p) => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <select
                    className="w-full rounded-2xl border bg-white px-3 py-3 text-sm"
                    value={newAssignedTo}
                    onChange={(e) => setNewAssignedTo(e.target.value)}
                    disabled={!selectedAppId}
                  >
                    <option value="">Responsable (opcional)…</option>
                    {people.map((p) => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="hidden" aria-hidden="true" />
              </form>

              <Typography variant="small" className="mt-3 text-gray-500 leading-5 hidden md:block">
                Click en un ticket = ver/editar. Drag entre columnas = estado. Drag dentro = prioridad.
              </Typography>
              <Typography variant="small" className="mt-1 text-gray-600">
                App: <b>{appDisplayName(selectedApp, appsArr)}</b>
              </Typography>
              <Typography variant="small" className="mt-3 text-gray-500 leading-5 md:hidden">
                Click = detalle. Drag funciona mejor en escritorio.
              </Typography>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                {STATUS.map((s) => {
                  const cx = accentClasses(s.accent);
                  const isOver = dragOverStatus === s.key;

                  return (
                    <div
                      key={s.key}
                      className={['rounded-2xl border bg-white overflow-hidden', isOver ? 'ring-2 ring-blue-gray-200' : ''].join(' ')}
                      onDragOver={(e) => onDragOverColumn(e, s.key)}
                      onDragEnter={(e) => onDragOverColumn(e, s.key)}
                      onDragLeave={() => setDragOverStatus((prev) => (prev === s.key ? null : prev))}
                      onDrop={(e) => onDropColumn(e, s.key)}
                    >
                      <div className={['border-b px-3 py-2', cx.header].join(' ')}>
                        <div className="flex items-center justify-between">
                          <Typography className="font-semibold text-blue-gray-900">{s.label}</Typography>
                          <span className={['text-xs rounded-full px-2 py-1', cx.pill].join(' ')}>
                            {ticketsByStatus[s.key].length}
                          </span>
                        </div>
                      </div>

                      <div className="max-h-[60vh] overflow-auto p-2 bg-gradient-to-b from-white to-gray-50">
                        {ticketsByStatus[s.key].map((t, idx) => {
                          const lastNote = (t.notes || []).slice(-1)[0]?.text || '';
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
                                'rounded-xl border p-3 mb-2 shadow-sm transition cursor-pointer bg-white',
                                cx.hover,
                                dragOverTicketId === t._id &&
                                dragRef.current.ticketId &&
                                dragRef.current.fromStatus === s.key &&
                                dragRef.current.ticketId !== t._id
                                  ? 'ring-2 ring-blue-gray-100'
                                  : '',
                              ].join(' ')}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <Typography className="font-semibold text-blue-gray-900 break-words leading-5">{t.title}</Typography>
                                <span className="text-xs rounded-full bg-gray-100 px-2 py-1 text-gray-700">#{idx + 1}</span>
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
                                <Typography variant="small" className="mt-2 text-gray-400">Sin notas aún</Typography>
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
        </div>
      </div>

      {/* Ticket modal */}
      <Modal
        open={ticketModalOpen && !!selectedTicket}
        title="Detalle del ticket"
        onClose={() => setTicketModalOpen(false)}
        footer={null}
      >
        {!selectedTicket ? null : (
          <>
            <div className="rounded-2xl border bg-white p-3">
              {editingTitle.ticketId === selectedTicket._id ? (
                <Input
                  label="Editando título (Enter guarda, Esc cancela)"
                  value={editingTitle.title}
                  onChange={(e) => setEditingTitle((prev) => ({ ...prev, title: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditingTitle({ ticketId: null, title: '' });
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveEditedTitle().catch(console.error);
                    }
                  }}
                />
              ) : (
                <Typography
                  className="font-semibold text-blue-gray-900 cursor-pointer break-words leading-5"
                  title="Click para editar título"
                  onClick={() => setEditingTitle({ ticketId: selectedTicket._id, title: selectedTicket.title })}
                >
                  {selectedTicket.title}
                </Typography>
              )}

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                <select
                  className="w-full rounded-2xl border bg-white px-3 py-3 text-sm"
                  value={selectedTicket.createdBy || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTickets((prev) => (Array.isArray(prev) ? prev : []).map((t) => (t._id === selectedTicket._id ? { ...t, createdBy: v } : t)));
                  }}
                >
                  <option value="">Abre (obligatorio)…</option>
                  {people.map((p) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>

                <select
                  className="w-full rounded-2xl border bg-white px-3 py-3 text-sm"
                  value={selectedTicket.assignedTo || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTickets((prev) => (Array.isArray(prev) ? prev : []).map((t) => (t._id === selectedTicket._id ? { ...t, assignedTo: v } : t)));
                  }}
                >
                  <option value="">Responsable (opcional)…</option>
                  {people.map((p) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  className="flex-1 rounded-2xl bg-emerald-600 text-white py-3 font-semibold shadow-sm hover:bg-emerald-700 active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={savingTicket}
                  onClick={async () => {
                    try {
                      setSavingTicket(true);
                      await saveTicketPeople(selectedTicket);
                      setSavedOk(true);
                      setTimeout(() => {
                        setTicketModalOpen(false);
                        setSavedOk(false);
                      }, 2000);
                    } catch (e) {
                      console.error(e);
                      alert(e?.message || 'Error guardando');
                    } finally {
                      setSavingTicket(false);
                    }
                  }}
                  type="button"
                >
                  {savingTicket ? 'Guardando...' : 'Aceptar'}
                </button>

                <button
                  className="flex-1 rounded-2xl border border-red-200 text-red-700 py-3 font-semibold hover:bg-red-50 active:scale-[0.99] transition"
                  onClick={() => deleteTicket(selectedTicket._id).catch(console.error)}
                  type="button"
                >
                  Borrar ticket
                </button>
              </div>

              {savedOk ? (
                <Typography variant="small" className="mt-2 text-emerald-700">
                  ✅ Guardado. Cerrando...
                </Typography>
              ) : null}

              <Typography variant="small" className="mt-3 text-gray-600">
                Notas: Ctrl+Enter guarda. Click en una nota para editar.
              </Typography>
            </div>

            <form className="mt-3" onSubmit={onAddNote}>
              <Textarea
                label=""
                placeholder="Nueva nota (Ctrl+Enter guarda)"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    onAddNote(e);
                  }
                }}
              />
              <button type="submit" className="hidden" aria-hidden="true" />
            </form>

            <div className="mt-3 space-y-3">
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
                        <Typography className="whitespace-pre-wrap break-words text-blue-gray-900">{n.text}</Typography>
                        <Typography variant="small" className="mt-2 text-gray-600">{formatDate(n.at)}</Typography>
                      </>
                    ) : (
                      <>
                        <Textarea
                          label=""
                          placeholder="Editando (Ctrl+Enter guarda, Esc cancela)"
                          value={editingNote.text}
                          onChange={(e) => setEditingNote((prev) => ({ ...prev, text: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditingNote({ ticketId: null, noteId: null, text: '' });
                            if (e.ctrlKey && e.key === 'Enter') {
                              e.preventDefault();
                              saveEditedNote().catch(console.error);
                            }
                          }}
                        />
                        <div className="mt-2 flex items-center justify-between">
                          <Typography
                            variant="small"
                            className="text-red-600 cursor-pointer select-none"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNote(selectedTicket._id, n._id).catch(console.error);
                            }}
                          >
                            borrar nota
                          </Typography>
                          <Typography variant="small" className="text-gray-600">{formatDate(n.at)}</Typography>
                        </div>
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
      </Modal>

      {/* People modal */}
      <Modal
        open={peopleModal.open}
        title="Personas"
        onClose={() => setPeopleModal({ open: false, name: '', color: '' })}
        footer={
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-2xl bg-blue-gray-900 text-white py-3 font-semibold hover:bg-blue-gray-800 active:scale-[0.99] transition"
              onClick={() => createPerson().catch(console.error)}
              type="button"
            >
              Añadir
            </button>
            <button
              className="flex-1 rounded-2xl bg-gray-100 py-3 font-semibold hover:bg-gray-200 active:scale-[0.99] transition text-gray-900"
              onClick={() => setPeopleModal({ open: false, name: '', color: '' })}
              type="button"
            >
              Cerrar
            </button>
          </div>
        }
      >
        <Typography className="text-gray-700">Añade personas por nombre. El color es opcional (ej: #328077).</Typography>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="md:col-span-2">
            <Input label="Nombre (obligatorio)" value={peopleModal.name} onChange={(e) => setPeopleModal((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="md:col-span-1">
            <Input label="Color (opcional)" value={peopleModal.color} onChange={(e) => setPeopleModal((p) => ({ ...p, color: e.target.value }))} />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border bg-white p-3">
          <Typography variant="small" className="text-gray-600 mb-2">Lista</Typography>
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
            {people.length === 0 ? <Typography className="text-gray-600">Aún no hay personas.</Typography> : null}
          </div>
        </div>
      </Modal>

      {/* Rename app modal */}
      <Modal
        open={appActions.open && appActions.mode === 'rename'}
        title="Renombrar aplicación"
        onClose={() => setAppActions({ open: false, app: null, mode: null, name: '' })}
        footer={
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-2xl bg-blue-gray-900 text-white py-3 font-semibold hover:bg-blue-gray-800 active:scale-[0.99] transition"
              onClick={() => confirmAppAction().catch(console.error)}
              type="button"
            >
              Guardar
            </button>
            <button
              className="flex-1 rounded-2xl bg-gray-100 py-3 font-semibold hover:bg-gray-200 active:scale-[0.99] transition text-gray-900"
              onClick={() => setAppActions({ open: false, app: null, mode: null, name: '' })}
              type="button"
            >
              Cancelar
            </button>
          </div>
        }
      >
        <Typography className="text-gray-700">Nuevo nombre para <b>{appActions.app?.name}</b></Typography>
        <div className="mt-3">
          <Input label="Nombre" value={appActions.name} onChange={(e) => setAppActions((p) => ({ ...p, name: e.target.value }))} />
        </div>
      </Modal>

      {/* Delete app modal */}
      <Modal
        open={appActions.open && appActions.mode === 'delete'}
        title="Borrar aplicación"
        onClose={() => setAppActions({ open: false, app: null, mode: null, name: '' })}
        footer={
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-2xl bg-red-600 text-white py-3 font-semibold hover:bg-red-700 active:scale-[0.99] transition"
              onClick={() => confirmAppAction().catch(console.error)}
              type="button"
            >
              Borrar
            </button>
            <button
              className="flex-1 rounded-2xl bg-gray-100 py-3 font-semibold hover:bg-gray-200 active:scale-[0.99] transition text-gray-900"
              onClick={() => setAppActions({ open: false, app: null, mode: null, name: '' })}
              type="button"
            >
              Cancelar
            </button>
          </div>
        }
      >
        <Typography className="text-gray-700">
          Vas a borrar <b>{appActions.app?.name}</b>, sus sub-apps y <b>todos sus tickets</b>. Esta acción no se puede deshacer.
        </Typography>
      </Modal>
    </div>
  );
}
