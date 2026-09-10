import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  motion,
} from "motion/react";

import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BadgeDollarSign,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileClock,
  Mail,
  MapPin,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  Search,
  Ticket,
  Trash2,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import {
  addClientNote,
  createClient,
  createClientCredit,
  deleteClient,
  getClientActivity,
  getClientDisplayName,
  getClientDocument,
  refinanceClientDebt,
  setClientArchived,
  subscribeToClientActivityIndex,
  subscribeToClients,
  updateClient,
  updateClientCreditLimit,
} from "../../services/clientes.service.js";

import {
  notify,
} from "../../services/notifications.js";

import "./Clientes.css";

const EMPTY_CLIENT = {
  nombre: "",
  apellido: "",
  dni: "",
  cuit: "",
  direccion: "",
  provincia: "",
  localidad: "",
  barrio: "",
  tel: "",
  email: "",
  limiteCredito: "",
};

const EMPTY_CREDIT = {
  concept: "",
  capital: "",
  advance: "0",
  interest: "0",
  installments: "1",
  firstDueDate: "",
};

const STAGES = {
  pendiente: "Recibido",
  diagnostico: "Diagnóstico",
  presupuesto: "Presupuesto",
  presupuesto_rechazado: "Presupuesto rechazado",
  reparacion: "Reparación",
  repuesto: "Esperando repuesto",
  listo: "Listo",
  entregado: "Entregado",
  noreparable: "No reparable",
  cancelado: "Cancelado",
  garantia: "Garantía",
};

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(
    String(value).length === 10
      ? `${value}T12:00:00`
      : value
  );

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function initials(name) {
  return String(name || "C")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function errorMessage(error) {
  if (
    error?.message ===
    "CLIENT_HAS_ACTIVITY"
  ) {
    const labels = {
      tickets: "tickets",
      creditos: "créditos",
      ventas: "ventas",
      facturas: "facturas",
      presupuestos: "presupuestos",
      cajaPendientes: "operaciones de Caja",
      cuentaCorriente: "movimientos de cuenta corriente",
    };

    const detail =
      Object.entries(
        error.references || {}
      )
        .filter(([, count]) => Number(count) > 0)
        .map(([key, count]) => `${count} ${labels[key] || key}`)
        .join(", ");

    return detail
      ? `No se puede eliminar porque tiene historial asociado: ${detail}.`
      : "No se puede eliminar porque el cliente tiene historial asociado.";
  }

  if (
    error?.message ===
    "CLIENT_ARCHIVE_BLOCKED"
  ) {
    const reasons =
      Array.isArray(
        error?.reasons
      )
        ? error.reasons
        : [];

    return reasons.length
      ? `No se puede archivar todavía: ${reasons.join(" ")}`
      : "No se puede archivar porque el cliente todavía tiene operaciones pendientes.";
  }

  const map = {
    CLIENT_NAME_REQUIRED: "Ingresá el nombre o razón social.",
    CLIENT_DUPLICATE: "Ya existe un cliente con el mismo DNI, CUIT, teléfono o correo.",
    CLIENT_ID_REQUIRED: "No pudimos identificar al cliente.",
    CLIENT_NOTE_REQUIRED: "Escribí una nota.",
    CLIENT_REQUIRED: "Seleccioná un cliente.",
    CLIENT_BALANCE_EXISTS: `No se puede eliminar un cliente con saldo a favor (${formatMoney(error?.balance)}).`,
    CLIENT_ARCHIVED: "El cliente está archivado. Restauralo antes de crear nuevas operaciones.",
    CREDIT_CAPITAL_INVALID: "El capital debe ser mayor a cero.",
    CREDIT_ADVANCE_INVALID: "El anticipo debe ser menor que el capital.",
    CREDIT_LIMIT_EXCEEDED: `Cupo insuficiente. Disponible: ${formatMoney(error?.available)}.`,
    CLIENT_NO_ACTIVE_DEBT: "El cliente no tiene deuda activa para refinanciar.",
  };

  return map[error?.message] || error?.message || "Ocurrió un error inesperado.";
}

export default function Clientes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, user } = useAuth();

  const author =
    profile?.nombre ||
    profile?.name ||
    user?.email ||
    "Sistema";

  const [clients, setClients] = useState([]);
  const [index, setIndex] = useState({
    tickets: [],
    sales: [],
    credits: [],
  });

  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("active");

  const [selectedClientId, setSelectedClientId] = useState(
    () => searchParams.get("cliente") || null
  );
  const [activeTab, setActiveTab] = useState(
    () => {
      const tab = searchParams.get("tab");
      return ["summary", "tickets", "sales", "credits"].includes(tab)
        ? tab
        : "summary";
    }
  );

  const [clientModal, setClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT);
  const [savingClient, setSavingClient] = useState(false);
  const [deletingClient, setDeletingClient] = useState(false);
  const [archivingClient, setArchivingClient] = useState(false);

  const [creditModal, setCreditModal] = useState(false);
  const [creditMode, setCreditMode] = useState("new");
  const [creditForm, setCreditForm] = useState(EMPTY_CREDIT);
  const [savingCredit, setSavingCredit] = useState(false);

  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [limitValue, setLimitValue] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);

  useEffect(() => {
    const unsubscribeClients = subscribeToClients(
      setClients,
      (error) => {
        console.error(error);
        notify.error("Clientes", "No se pudieron cargar los clientes.");
      }
    );

    const unsubscribeIndex = subscribeToClientActivityIndex(
      setIndex,
      (error) => {
        console.error(error);
      }
    );

    return () => {
      unsubscribeClients();
      unsubscribeIndex();
    };
  }, []);

  /* =======================================
     CONTEXTO DE CLIENTE EN LA URL
     Permite volver al mismo perfil y pestaña.
  ======================================= */

  useEffect(() => {
    const clientId =
      searchParams.get("cliente") ||
      null;

    const requestedTab =
      searchParams.get("tab");

    const tab =
      ["summary", "tickets", "sales", "credits"].includes(requestedTab)
        ? requestedTab
        : "summary";

    setSelectedClientId(clientId);
    setActiveTab(tab);
  }, [searchParams]);

  const setClientContext = (
    clientId,
    tab = "summary"
  ) => {
    const next =
      new URLSearchParams(
        searchParams
      );

    if (clientId) {
      next.set(
        "cliente",
        clientId
      );

      next.set(
        "tab",
        ["summary", "tickets", "sales", "credits"].includes(tab)
          ? tab
          : "summary"
      );
    } else {
      next.delete("cliente");
      next.delete("tab");
    }

    setSearchParams(
      next,
      { replace: true }
    );
  };

  const selectedClient = useMemo(
    () =>
      clients.find((client) => client.id === selectedClientId) ||
      null,
    [clients, selectedClientId]
  );

  const selectedActivity = useMemo(
    () =>
      selectedClient
        ? getClientActivity(selectedClient, index)
        : null,
    [selectedClient, index]
  );

  useEffect(() => {
    if (selectedClient) {
      setLimitValue(String(Number(selectedClient.limiteCredito || 0)));
    }
  }, [selectedClient]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return clients.filter((client) => {
      const archived =
        client.archivado ===
        true;

      const matchesFilter =
        clientFilter === "all" ||
        (clientFilter === "archived"
          ? archived
          : !archived);

      if (!matchesFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        getClientDisplayName(client),
        getClientDocument(client),
        client.tel,
        client.email,
        client.localidad,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    clients,
    search,
    clientFilter,
  ]);

  const metrics = useMemo(() => {
    let debt = 0;
    let purchases = 0;

    clients.forEach((client) => {
      const activity = getClientActivity(client, index);
      debt += activity.debt;
      purchases += activity.purchases;
    });

    return {
      total: clients.length,
      active: clients.filter(
        (client) =>
          client.archivado !==
          true
      ).length,
      archived: clients.filter(
        (client) =>
          client.archivado ===
          true
      ).length,
      debt,
      purchases,
      creditBalance: clients.reduce(
        (sum, client) => sum + Number(client.saldoAFavor || 0),
        0
      ),
    };
  }, [clients, index]);

  const openClient = (client) => {
    setClientContext(
      client.id,
      "summary"
    );
  };

  const openNewClient = () => {
    setEditingClient(false);
    setClientForm(EMPTY_CLIENT);
    setClientModal(true);
  };

  const openEditClient = () => {
    if (!selectedClient) return;

    setEditingClient(true);
    setClientForm({
      nombre: selectedClient.nombre || selectedClient.razonSocial || "",
      apellido: selectedClient.apellido || "",
      dni: selectedClient.dni || "",
      cuit: selectedClient.cuit || "",
      direccion: selectedClient.direccion === "—" ? "" : selectedClient.direccion || "",
      provincia: selectedClient.provincia || "",
      localidad: selectedClient.localidad || "",
      barrio: selectedClient.barrio || "",
      tel: selectedClient.tel === "—" ? "" : selectedClient.tel || "",
      email: selectedClient.email === "—" ? "" : selectedClient.email || "",
      limiteCredito: selectedClient.limiteCredito || 0,
    });
    setClientModal(true);
  };

  const handleSaveClient = async () => {
    try {
      setSavingClient(true);

      if (editingClient && selectedClient) {
        await updateClient(
          selectedClient.id,
          {
            ...clientForm,
            author,
          }
        );

        notify.success("Cliente actualizado", "Los datos se guardaron correctamente.");
      } else {
        const created = await createClient({
          ...clientForm,
          author,
        });

        setClientContext(
          created.id,
          "summary"
        );
        notify.success("Cliente creado", `${getClientDisplayName(created)} fue registrado.`);
      }

      setClientModal(false);
      setClientForm(EMPTY_CLIENT);
    } catch (error) {
      console.error(error);
      notify.error("No se pudo guardar", errorMessage(error));
    } finally {
      setSavingClient(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!selectedClient) return;

    const name =
      getClientDisplayName(
        selectedClient
      );

    const confirmed =
      window.confirm(
        `¿Eliminar definitivamente a ${name}?\n\nSolo se permitirá si no tiene tickets, créditos, ventas, facturas, presupuestos, movimientos de Caja o cuenta corriente asociados.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingClient(true);

      await deleteClient(
        selectedClient
      );

      setClientContext(
        null
      );

      notify.success(
        "Cliente eliminado",
        `${name} fue eliminado de la base de clientes.`
      );
    } catch (error) {
      console.error(error);

      notify.error(
        "No se pudo eliminar",
        errorMessage(error)
      );
    } finally {
      setDeletingClient(false);
    }
  };

  const handleArchiveClient = async () => {
    if (!selectedClient) return;

    const archived =
      selectedClient.archivado ===
      true;

    const name =
      getClientDisplayName(
        selectedClient
      );

    const confirmed =
      window.confirm(
        archived
          ? `¿Restaurar a ${name}?\n\nEl cliente volverá a quedar habilitado para nuevas operaciones.`
          : `¿Archivar a ${name}?\n\nEl historial no se elimina. Solo podrá archivarse si no tiene tickets abiertos, créditos con saldo, operaciones pendientes en Caja ni saldo a favor.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setArchivingClient(
        true
      );

      await setClientArchived(
        selectedClient,
        !archived,
        author
      );

      if (archived) {
        setClientFilter(
          "active"
        );

        notify.success(
          "Cliente restaurado",
          `${name} volvió a quedar activo.`
        );
      } else {
        setClientFilter(
          "archived"
        );

        notify.success(
          "Cliente archivado",
          `${name} quedó archivado sin perder su historial.`
        );
      }
    } catch (error) {
      console.error(
        error
      );

      notify.error(
        archived
          ? "No se pudo restaurar"
          : "No se pudo archivar",
        errorMessage(
          error
        )
      );
    } finally {
      setArchivingClient(
        false
      );
    }
  };

  const handleSaveLimit = async () => {
    if (!selectedClient) return;

    try {
      setSavingLimit(true);

      const value = await updateClientCreditLimit(
        selectedClient.id,
        limitValue,
        author
      );

      notify.success("Límite actualizado", `Nuevo límite: ${formatMoney(value)}.`);
    } catch (error) {
      console.error(error);
      notify.error("No se pudo actualizar", errorMessage(error));
    } finally {
      setSavingLimit(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedClient) return;

    try {
      setSavingNote(true);

      await addClientNote(
        selectedClient.id,
        note,
        author
      );

      setNote("");
      notify.success("Nota agregada", "Quedó registrada en el perfil del cliente.");
    } catch (error) {
      console.error(error);
      notify.error("No se pudo guardar", errorMessage(error));
    } finally {
      setSavingNote(false);
    }
  };

  const openCredit = (mode) => {
    if (!selectedClient) return;

    if (
      selectedClient.archivado ===
      true
    ) {
      notify.warning(
        "Cliente archivado",
        "Restauralo antes de crear o refinanciar un crédito."
      );

      return;
    }

    setCreditMode(mode);
    setCreditForm({
      ...EMPTY_CREDIT,
      concept:
        mode === "refinance"
          ? "Refinanciación de Deuda Anterior"
          : "Otorgamiento de Crédito",
    });
    setCreditModal(true);
  };

  const handleSaveCredit = async () => {
    if (!selectedClient) return;

    try {
      setSavingCredit(true);

      if (creditMode === "refinance") {
        await refinanceClientDebt({
          client: selectedClient,
          interest: creditForm.interest,
          installments: creditForm.installments,
          firstDueDate: creditForm.firstDueDate,
          author,
        });

        notify.success("Deuda refinanciada", "Se creó una nueva carpeta con la deuda unificada.");
      } else {
        await createClientCredit({
          client: selectedClient,
          concept: creditForm.concept,
          capital: creditForm.capital,
          advance: creditForm.advance,
          interest: creditForm.interest,
          installments: creditForm.installments,
          firstDueDate: creditForm.firstDueDate,
          author,
        });

        notify.success("Crédito creado", "La nueva carpeta fue registrada.");
      }

      setCreditModal(false);
      setCreditForm(EMPTY_CREDIT);
      setClientContext(
        selectedClient.id,
        "credits"
      );
    } catch (error) {
      console.error(error);
      notify.error("No se pudo procesar", errorMessage(error));
    } finally {
      setSavingCredit(false);
    }
  };

  const openTicketFromClient = (ticket) => {
    if (!selectedClient) return;

    const returnTo =
      `/clientes?cliente=${encodeURIComponent(selectedClient.id)}&tab=tickets`;

    navigate(
      `/tickets/${ticket.id}`,
      {
        state: {
          returnTo,
          fromClient: {
            clientId: selectedClient.id,
            tab: "tickets",
          },
        },
      }
    );
  };

  const openCreditFromClient = (credit) => {
    if (!selectedClient) return;

    const returnTo =
      `/clientes?cliente=${encodeURIComponent(selectedClient.id)}&tab=credits`;

    navigate(
      "/creditos",
      {
        state: {
          creditId: credit.id,
          returnTo,
          fromClient: {
            clientId: selectedClient.id,
            tab: "credits",
          },
        },
      }
    );
  };

  return (
    <main className="clients-page">
      <div className="clients-shell">
        <header className="clients-header">
          <div className="clients-heading">
            <button
              type="button"
              className="clients-back"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft size={17} />
              Dashboard
            </button>

            <span className="clients-eyebrow">Clientes / Cuenta comercial</span>
            <h1>Clientes</h1>
            <p>Perfiles, tickets, compras, créditos y saldo a favor.</p>
          </div>

          <button
            type="button"
            className="clients-primary"
            onClick={openNewClient}
          >
            <Plus size={17} />
            Nuevo cliente
          </button>
        </header>

        <section className="clients-metrics">
          <article>
            <span><Users size={17} /> Activos</span>
            <strong>{metrics.active}</strong>
            <small>{metrics.total} clientes registrados</small>
          </article>

          <article>
            <span><Archive size={17} /> Archivados</span>
            <strong>{metrics.archived}</strong>
            <small>Con historial conservado</small>
          </article>

          <article>
            <span><ReceiptText size={17} /> Compras</span>
            <strong>{formatMoney(metrics.purchases)}</strong>
            <small>Histórico registrado</small>
          </article>

          <article>
            <span><CreditCard size={17} /> Deuda activa</span>
            <strong>{formatMoney(metrics.debt)}</strong>
            <small>Carpetas con saldo</small>
          </article>

          <article>
            <span><WalletCards size={17} /> Saldo a favor</span>
            <strong>{formatMoney(metrics.creditBalance)}</strong>
            <small>Disponible para cobros</small>
          </article>
        </section>

        <section className="clients-workspace">
          <div className="clients-list-panel">
            <div className="clients-toolbar">
              <div>
                <span>Directorio</span>
                <h2>Base de clientes</h2>
              </div>

              <div className="clients-toolbar-actions">
                <div className="clients-directory-filters">
                  {[
                    ["active", "Activos"],
                    ["archived", "Archivados"],
                    ["all", "Todos"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={
                        clientFilter === id
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        setClientFilter(
                          id
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <label className="clients-search">
                  <Search size={16} />
                  <input
                    value={search}
                    placeholder="Nombre, DNI, CUIT, teléfono..."
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="clients-table-wrap">
              <table className="clients-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Contacto</th>
                    <th>Tickets</th>
                    <th>Compras</th>
                    <th>Deuda</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {rows.map((client) => {
                    const activity = getClientActivity(client, index);
                    const name = getClientDisplayName(client);

                    return (
                      <tr
                        key={client.id}
                        className={[
                          selectedClientId === client.id
                            ? "active"
                            : "",
                          client.archivado === true
                            ? "archived"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => openClient(client)}
                      >
                        <td>
                          <div className="clients-person">
                            <div>{initials(name)}</div>
                            <section>
                              <strong>{name}</strong>
                              <span>
                                {getClientDocument(client)}
                                {client.archivado === true
                                  ? " · Archivado"
                                  : ""}
                              </span>
                            </section>
                          </div>
                        </td>

                        <td>
                          <strong className="clients-cell-main">{client.tel || "—"}</strong>
                          <span className="clients-cell-sub">{client.localidad || client.email || "Sin ubicación"}</span>
                        </td>

                        <td>{activity.tickets.length}</td>
                        <td>{formatMoney(activity.purchases)}</td>
                        <td className={activity.debt > 0 ? "clients-debt" : ""}>
                          {formatMoney(activity.debt)}
                        </td>

                        <td>
                          <ChevronRight size={17} />
                        </td>
                      </tr>
                    );
                  })}

                  {!rows.length && (
                    <tr>
                      <td colSpan="6">
                        <div className="clients-empty">
                          <UserRound size={26} />
                          <strong>Sin resultados</strong>
                          <span>No encontramos clientes con ese filtro.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="clients-profile">
            {!selectedClient ? (
              <div className="clients-profile-empty">
                <UserRound size={34} />
                <strong>Seleccioná un cliente</strong>
                <span>Su información y actividad aparecerán acá.</span>
              </div>
            ) : (
              <>
                <div className="clients-profile-head">
                  <div className="clients-avatar">
                    {initials(getClientDisplayName(selectedClient))}
                  </div>

                  <div>
                    <span>Perfil</span>
                    <h2>{getClientDisplayName(selectedClient)}</h2>
                    <p>
                      {getClientDocument(selectedClient)}
                      {selectedClient.archivado === true && (
                        <strong className="clients-archived-badge">
                          Archivado
                        </strong>
                      )}
                    </p>
                  </div>

                  <div className="clients-profile-head-actions">
                    <button
                      type="button"
                      onClick={openEditClient}
                      title="Editar cliente"
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      type="button"
                      className={
                        selectedClient.archivado === true
                          ? "restore"
                          : "archive"
                      }
                      disabled={archivingClient}
                      onClick={handleArchiveClient}
                      title={
                        selectedClient.archivado === true
                          ? "Restaurar cliente"
                          : "Archivar cliente"
                      }
                    >
                      {selectedClient.archivado === true ? (
                        <ArchiveRestore size={16} />
                      ) : (
                        <Archive size={16} />
                      )}
                    </button>

                    <button
                      type="button"
                      className="danger"
                      disabled={
                        deletingClient ||
                        archivingClient
                      }
                      onClick={handleDeleteClient}
                      title="Eliminar cliente"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="clients-contact-grid">
                  <div>
                    <Phone size={15} />
                    <span>Teléfono</span>
                    <strong>{selectedClient.tel || "—"}</strong>
                  </div>

                  <div>
                    <Mail size={15} />
                    <span>Correo</span>
                    <strong>{selectedClient.email || "—"}</strong>
                  </div>

                  <div className="wide">
                    <MapPin size={15} />
                    <span>Dirección</span>
                    <strong>
                      {[selectedClient.direccion, selectedClient.localidad, selectedClient.provincia]
                        .filter((value) => value && value !== "—")
                        .join(", ") || "—"}
                    </strong>
                  </div>
                </div>

                {selectedClient.archivado === true && (
                  <div className="clients-archived-notice">
                    <Archive size={17} />
                    <div>
                      <strong>Cliente archivado</strong>
                      <span>
                        El historial sigue disponible, pero las nuevas operaciones están bloqueadas hasta restaurarlo.
                      </span>
                    </div>
                  </div>
                )}

                <div className="clients-finance-strip">
                  <div>
                    <span>Deuda</span>
                    <strong>{formatMoney(selectedActivity?.debt)}</strong>
                  </div>
                  <div>
                    <span>Cupo disponible</span>
                    <strong>{formatMoney(selectedActivity?.availableCredit)}</strong>
                  </div>
                  <div>
                    <span>Saldo a favor</span>
                    <strong>{formatMoney(selectedClient.saldoAFavor)}</strong>
                  </div>
                </div>

                <div className="clients-profile-actions">
                  <button
                    type="button"
                    disabled={
                      selectedClient.archivado ===
                      true
                    }
                    onClick={() => openCredit("new")}
                  >
                    <BadgeDollarSign size={15} />
                    Nuevo crédito
                  </button>

                  <button
                    type="button"
                    disabled={
                      selectedClient.archivado ===
                        true ||
                      !selectedActivity?.activeCredits.length
                    }
                    onClick={() => openCredit("refinance")}
                  >
                    <FileClock size={15} />
                    Refinanciar
                  </button>
                </div>

                <nav className="clients-tabs">
                  {[
                    ["summary", "Resumen"],
                    ["tickets", `Tickets ${selectedActivity?.tickets.length || 0}`],
                    ["sales", `Compras ${selectedActivity?.sales.length || 0}`],
                    ["credits", `Créditos ${selectedActivity?.credits.length || 0}`],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={activeTab === id ? "active" : ""}
                      onClick={() =>
                        setClientContext(
                          selectedClient.id,
                          id
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </nav>

                <div className="clients-profile-body">
                  {activeTab === "summary" && (
                    <div className="clients-summary">
                      <section>
                        <div className="clients-section-title">
                          <div>
                            <span>Crédito</span>
                            <h3>Límite comercial</h3>
                          </div>
                          <CircleDollarSign size={18} />
                        </div>

                        <div className="clients-limit-row">
                          <input
                            type="number"
                            min="0"
                            value={limitValue}
                            disabled={
                              selectedClient.archivado ===
                              true
                            }
                            onChange={(event) => setLimitValue(event.target.value)}
                          />
                          <button
                            type="button"
                            disabled={
                              savingLimit ||
                              selectedClient.archivado ===
                                true
                            }
                            onClick={handleSaveLimit}
                          >
                            {savingLimit ? "Guardando..." : "Guardar"}
                          </button>
                        </div>
                      </section>

                      <section>
                        <div className="clients-section-title">
                          <div>
                            <span>Bitácora</span>
                            <h3>Notas del cliente</h3>
                          </div>
                          <NotebookPen size={18} />
                        </div>

                        <textarea
                          rows="3"
                          value={note}
                          placeholder="Ej: Prefiere contacto telefónico por la tarde..."
                          onChange={(event) => setNote(event.target.value)}
                        />

                        <button
                          type="button"
                          className="clients-note-save"
                          disabled={savingNote || !note.trim()}
                          onClick={handleAddNote}
                        >
                          {savingNote ? "Guardando..." : "Agregar nota"}
                        </button>

                        <div className="clients-notes-list">
                          {(selectedClient.notas || [])
                            .slice()
                            .reverse()
                            .map((item, indexNote) => {
                              const data =
                                typeof item === "string"
                                  ? { texto: item }
                                  : item;

                              return (
                                <article key={`${data.fecha || "nota"}-${indexNote}`}>
                                  <strong>{data.texto || data.detalle || "Nota"}</strong>
                                  <span>
                                    {data.autor || "Sistema"}
                                    {data.fecha ? ` · ${formatDate(data.fecha)}` : ""}
                                  </span>
                                </article>
                              );
                            })}

                          {!(selectedClient.notas || []).length && (
                            <small>Sin notas registradas.</small>
                          )}
                        </div>
                      </section>
                    </div>
                  )}

                  {activeTab === "tickets" && (
                    <div className="clients-activity-list">
                      {selectedActivity?.tickets.map((ticket) => (
                        <button
                          type="button"
                          key={ticket.id}
                          onClick={() =>
                            openTicketFromClient(
                              ticket
                            )
                          }
                        >
                          <div className="clients-activity-icon">
                            <Ticket size={16} />
                          </div>
                          <section>
                            <strong>#{ticket.id} · {ticket.equipo || "Equipo"}</strong>
                            <span>{ticket.falla || "Sin falla informada"}</span>
                          </section>
                          <span className="clients-state">
                            {STAGES[ticket.stage] || ticket.stage || "Pendiente"}
                          </span>
                        </button>
                      ))}

                      {!selectedActivity?.tickets.length && (
                        <div className="clients-empty compact">
                          <Ticket size={23} />
                          <strong>Sin tickets</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "sales" && (
                    <div className="clients-activity-list">
                      {selectedActivity?.sales.map((sale) => (
                        <article key={sale.id}>
                          <div className="clients-activity-icon">
                            <ReceiptText size={16} />
                          </div>
                          <section>
                            <strong>{sale.folio || sale.id}</strong>
                            <span>{sale.articulos || sale.concepto || "Venta"}</span>
                          </section>
                          <strong>{formatMoney(sale.total)}</strong>
                        </article>
                      ))}

                      {!selectedActivity?.sales.length && (
                        <div className="clients-empty compact">
                          <ReceiptText size={23} />
                          <strong>Sin compras registradas</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "credits" && (
                    <div className="clients-credits-list">
                      {selectedActivity?.credits.map((credit) => (
                        <button
                          type="button"
                          key={credit.id}
                          onClick={() =>
                            openCreditFromClient(
                              credit
                            )
                          }
                        >
                          <div>
                            <span className={Number(credit.saldo || 0) > 0 ? "active" : "paid"}>
                              {Number(credit.saldo || 0) > 0 ? "Activo" : "Finalizado"}
                            </span>
                            <strong>{credit.concepto || "Crédito"}</strong>
                            <small>{credit.id} · {formatDate(credit.fechaOrigen)}</small>
                          </div>

                          <div>
                            <span>Original</span>
                            <strong>{formatMoney(credit.original)}</strong>
                          </div>

                          <div>
                            <span>Saldo</span>
                            <strong>{formatMoney(credit.saldo)}</strong>
                          </div>

                          <ChevronRight size={17} />
                        </button>
                      ))}

                      {!selectedActivity?.credits.length && (
                        <div className="clients-empty compact">
                          <CreditCard size={23} />
                          <strong>Sin carpetas de crédito</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        </section>
      </div>

      {clientModal && (
        <div
          className="clients-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingClient) {
              setClientModal(false);
            }
          }}
        >
          <motion.div
            className="clients-modal"
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <header>
              <div>
                <span>{editingClient ? "Editar" : "Alta"}</span>
                <h3>{editingClient ? "Editar cliente" : "Nuevo cliente"}</h3>
              </div>

              <button
                type="button"
                disabled={savingClient}
                onClick={() => setClientModal(false)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="clients-form">
              <label className="wide">
                <span>Nombre / Razón social *</span>
                <input
                  value={clientForm.nombre}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      nombre: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Apellido</span>
                <input
                  value={clientForm.apellido}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      apellido: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>DNI</span>
                <input
                  value={clientForm.dni}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      dni: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>CUIT</span>
                <input
                  value={clientForm.cuit}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      cuit: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Teléfono</span>
                <input
                  value={clientForm.tel}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      tel: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="wide">
                <span>Correo</span>
                <input
                  type="email"
                  value={clientForm.email}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="wide">
                <span>Dirección</span>
                <input
                  value={clientForm.direccion}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      direccion: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Provincia</span>
                <input
                  value={clientForm.provincia}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      provincia: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Localidad</span>
                <input
                  value={clientForm.localidad}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      localidad: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Barrio / Zona</span>
                <input
                  value={clientForm.barrio}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      barrio: event.target.value,
                    }))
                  }
                />
              </label>

              {!editingClient && (
                <label>
                  <span>Límite de crédito</span>
                  <input
                    type="number"
                    min="0"
                    value={clientForm.limiteCredito}
                    onChange={(event) =>
                      setClientForm((current) => ({
                        ...current,
                        limiteCredito: event.target.value,
                      }))
                    }
                  />
                </label>
              )}
            </div>

            <footer>
              <button
                type="button"
                className="ghost"
                disabled={savingClient}
                onClick={() => setClientModal(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="primary"
                disabled={savingClient}
                onClick={handleSaveClient}
              >
                {savingClient ? "Guardando..." : "Guardar cliente"}
              </button>
            </footer>
          </motion.div>
        </div>
      )}

      {creditModal &&
        selectedClient &&
        selectedClient.archivado !== true && (
        <div
          className="clients-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingCredit) {
              setCreditModal(false);
            }
          }}
        >
          <motion.div
            className="clients-modal credit"
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <header>
              <div>
                <span>Financiación</span>
                <h3>
                  {creditMode === "refinance"
                    ? "Refinanciar deuda"
                    : "Nueva carpeta de crédito"}
                </h3>
                <p>{getClientDisplayName(selectedClient)}</p>
              </div>

              <button
                type="button"
                disabled={savingCredit}
                onClick={() => setCreditModal(false)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="clients-form">
              {creditMode === "new" && (
                <>
                  <label className="wide">
                    <span>Concepto</span>
                    <input
                      value={creditForm.concept}
                      onChange={(event) =>
                        setCreditForm((current) => ({
                          ...current,
                          concept: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    <span>Capital</span>
                    <input
                      type="number"
                      min="0"
                      value={creditForm.capital}
                      onChange={(event) =>
                        setCreditForm((current) => ({
                          ...current,
                          capital: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    <span>Anticipo en efectivo</span>
                    <input
                      type="number"
                      min="0"
                      value={creditForm.advance}
                      onChange={(event) =>
                        setCreditForm((current) => ({
                          ...current,
                          advance: event.target.value,
                        }))
                      }
                    />
                  </label>
                </>
              )}

              {creditMode === "refinance" && (
                <div className="clients-refinance-summary wide">
                  <span>Deuda a refinanciar</span>
                  <strong>{formatMoney(selectedActivity?.debt)}</strong>
                </div>
              )}

              <label>
                <span>Interés global (%)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={creditForm.interest}
                  onChange={(event) =>
                    setCreditForm((current) => ({
                      ...current,
                      interest: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Cuotas</span>
                <select
                  value={creditForm.installments}
                  onChange={(event) =>
                    setCreditForm((current) => ({
                      ...current,
                      installments: event.target.value,
                    }))
                  }
                >
                  {[1, 2, 3, 4, 5, 6, 9, 12, 18, 24].map((value) => (
                    <option key={value} value={value}>
                      {value} {value === 1 ? "cuota" : "cuotas"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="wide">
                <span>Primer vencimiento</span>
                <input
                  type="date"
                  value={creditForm.firstDueDate}
                  onChange={(event) =>
                    setCreditForm((current) => ({
                      ...current,
                      firstDueDate: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <footer>
              <button
                type="button"
                className="ghost"
                disabled={savingCredit}
                onClick={() => setCreditModal(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="primary"
                disabled={savingCredit}
                onClick={handleSaveCredit}
              >
                {savingCredit
                  ? "Procesando..."
                  : creditMode === "refinance"
                    ? "Confirmar refinanciación"
                    : "Crear crédito"}
              </button>
            </footer>
          </motion.div>
        </div>
      )}
    </main>
  );
}
