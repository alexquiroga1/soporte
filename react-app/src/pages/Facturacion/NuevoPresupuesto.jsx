import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  AnimatePresence,
  motion,
} from "motion/react";

import {
  AlertTriangle,
  ArrowLeft,
  Barcode,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  Info,
  Package,
  PencilLine,
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
  UserPlus,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext.jsx";

import {
  createClient,
  getClientDisplayName,
  getClientDocument,
  subscribeToClients,
} from "../../services/clientes.service.js";

import {
  subscribeToProducts,
} from "../../services/productos.service.js";

import {
  createBudgetRevision,
  createManualBudget,
  subscribeToBudget,
} from "../../services/presupuestos.service.js";

import {
  subscribeToBusinessConfig,
} from "../../services/configuracion.service.js";

import "./NuevoPresupuesto.css";

const EMPTY_CLIENT = {
  nombre: "",
  apellido: "",
  dni: "",
  cuit: "",
  tel: "",
  email: "",
  direccion: "",
};

const EMPTY_MANUAL_ITEM = {
  descripcion: "",
  cantidad: "1",
  precio: "",
};

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(number(value));
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isService(product) {
  return (
    normalize(product?.tipo) === "servicio" ||
    normalize(product?.categoria) === "servicios"
  );
}

function availableStock(product) {
  if (isService(product)) return Infinity;
  return Math.max(0, number(product?.stock) - number(product?.stockReservado));
}

function createCatalogItem(product) {
  return {
    id: uid(),
    productoId: product.docId || product.id || product.sku || "",
    descripcion: product.nombre || "Producto",
    sku: product.sku || product.id || "",
    tipo: isService(product) ? "Servicio" : "Producto",
    origenItem: "Catálogo",
    cantidad: 1,
    precio: number(product.precio),
  };
}

function createManualItem(values = {}) {
  return {
    id: uid(),
    productoId: "",
    descripcion: String(values.descripcion || "").trim(),
    sku: "",
    tipo: "Concepto manual",
    origenItem: "Manual",
    cantidad: Math.max(1, number(values.cantidad) || 1),
    precio: Math.max(0, number(values.precio)),
  };
}

function getErrorMessage(error) {
  const map = {
    BUDGET_CLIENT_REQUIRED: "Seleccioná un cliente.",
    BUDGET_CLIENT_ARCHIVED: "El cliente está archivado.",
    BUDGET_ITEMS_REQUIRED: "Agregá al menos un producto, servicio o concepto manual.",
    BUDGET_ITEM_INVALID: "Revisá descripción, cantidad y precio de los conceptos.",
    BUDGET_TOTAL_INVALID: "El total debe ser mayor que cero.",
    BUDGET_NOT_FOUND: "El presupuesto ya no existe.",
    BUDGET_REVISION_FINANCIAL_LOCK: "No se puede revisar un presupuesto que ya tiene una operación financiera.",
    BUDGET_REVISION_ACCEPTED_LOCK: "Un presupuesto aceptado no puede revisarse sin resolver primero su estado comercial.",
    CLIENT_NAME_REQUIRED: "Ingresá el nombre o razón social del cliente.",
    CLIENT_DUPLICATE: "Ya existe un cliente con ese DNI, CUIT, teléfono o email.",
  };

  return map[error?.message] || error?.message || "No se pudo completar la operación.";
}

function AuroraToast({ toast, onClose }) {
  const timerRef = useRef(null);
  const startedRef = useRef(Date.now());
  const remainingRef = useRef(4200);

  const startTimer = useCallback(() => {
    startedRef.current = Date.now();
    timerRef.current = window.setTimeout(onClose, remainingRef.current);
  }, [onClose]);

  useEffect(() => {
    startTimer();
    return () => window.clearTimeout(timerRef.current);
  }, [startTimer]);

  const pause = () => {
    window.clearTimeout(timerRef.current);
    remainingRef.current = Math.max(
      500,
      remainingRef.current - (Date.now() - startedRef.current)
    );
  };

  const resume = () => {
    window.clearTimeout(timerRef.current);
    startTimer();
  };

  const Icon =
    toast.type === "error"
      ? XCircle
      : toast.type === "warning"
        ? AlertTriangle
        : toast.type === "info"
          ? Info
          : CheckCircle2;

  return (
    <motion.div
      className={`manual-aurora-toast ${toast.type}`}
      initial={{ opacity: 0, y: 18, x: 12, scale: 0.94, rotate: 0.8 }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, x: 26, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      <div className="manual-aurora-toast-icon"><Icon size={21} /></div>
      <div className="manual-aurora-toast-copy">
        <strong>{toast.title}</strong>
        <span>{toast.description}</span>
      </div>
      <button type="button" className="manual-aurora-toast-close" onClick={onClose}>
        <X size={14} />
      </button>
      <div className="manual-aurora-toast-progress"><span /></div>
    </motion.div>
  );
}

export default function NuevoPresupuesto() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const revisionId = searchParams.get("revision") || "";
  const revisionMode = Boolean(revisionId);
  const hydratedRevisionRef = useRef(false);

  const authContext = useAuth();
  const { profile, userProfile, user } = authContext || {};

  const author =
    profile?.nombre ||
    profile?.name ||
    userProfile?.nombre ||
    userProfile?.name ||
    user?.email ||
    "Sistema";

  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [revisionBudget, setRevisionBudget] = useState(null);
  const [loadingRevision, setLoadingRevision] = useState(revisionMode);

  const [selectedClient, setSelectedClient] = useState(null);
  const [clientQuery, setClientQuery] = useState("");
  const [clientSearchOpen, setClientSearchOpen] = useState(false);

  const [itemQuery, setItemQuery] = useState("");
  const [skuQuery, setSkuQuery] = useState("");
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [items, setItems] = useState([]);

  const [discountPercent, setDiscountPercent] = useState("0");
  const [validityDays, setValidityDays] = useState("15");
  const [leadTime, setLeadTime] = useState("48–72 hs");
  const [warranty, setWarranty] = useState("90 días mano de obra");
  const [observations, setObservations] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [revisionReason, setRevisionReason] = useState("");

  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [newClient, setNewClient] = useState(EMPTY_CLIENT);
  const [creatingClient, setCreatingClient] = useState(false);

  const [manualItemOpen, setManualItemOpen] = useState(false);
  const [manualItem, setManualItem] = useState(EMPTY_MANUAL_ITEM);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((type, title, description) => {
    const id = uid();
    setToasts((current) => [...current, { id, type, title, description }].slice(-4));
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToClients(
      (data) => {
        setClients(data);
        setLoadingClients(false);
      },
      (error) => {
        console.error(error);
        setLoadingClients(false);
        pushToast("error", "Clientes", "No se pudo cargar la base de clientes.");
      }
    );

    return unsubscribe;
  }, [pushToast]);

  useEffect(() => {
    const unsubscribe = subscribeToProducts(
      (data) => {
        setProducts(data);
        setLoadingProducts(false);
      },
      (error) => {
        console.error(error);
        setLoadingProducts(false);
        pushToast("error", "Catálogo", "No se pudo cargar el catálogo de productos y servicios.");
      }
    );

    return unsubscribe;
  }, [pushToast]);

  useEffect(() => {
    const unsubscribe = subscribeToBusinessConfig(
      (config) => {
        if (revisionMode) return;
        const days = number(config?.presupuestoValidezDias);
        if (days > 0) setValidityDays(String(Math.trunc(days)));
      },
      (error) => console.error(error)
    );

    return unsubscribe;
  }, [revisionMode]);

  useEffect(() => {
    if (!revisionMode) return undefined;

    setLoadingRevision(true);
    const unsubscribe = subscribeToBudget(
      revisionId,
      (budget) => {
        if (!budget) {
          pushToast("error", "Presupuesto no encontrado", "No pudimos cargar la revisión solicitada.");
          setLoadingRevision(false);
          return;
        }

        setRevisionBudget(budget);
        setLoadingRevision(false);
      },
      (error) => {
        console.error(error);
        setLoadingRevision(false);
        pushToast("error", "No se pudo cargar", "Revisá la conexión o los permisos.");
      }
    );

    return unsubscribe;
  }, [pushToast, revisionId, revisionMode]);

  useEffect(() => {
    if (!revisionMode || !revisionBudget || hydratedRevisionRef.current) return;

    const sourceItems = Array.isArray(revisionBudget.items) ? revisionBudget.items : [];

    setItems(
      sourceItems.map((item) => ({
        id: uid(),
        productoId: item.productoId || "",
        descripcion: item.descripcion || item.nombre || "Concepto",
        sku: item.sku || "",
        tipo: item.tipo || (item.sku ? "Producto" : "Concepto manual"),
        origenItem: item.origenItem || (item.sku ? "Catálogo" : "Manual"),
        cantidad: Math.max(1, number(item.cantidad || item.cant || 1)),
        precio: Math.max(0, number(item.precio ?? item.costo)),
      }))
    );

    setDiscountPercent(String(number(revisionBudget.descuentoPorcentaje)));
    setValidityDays(String(Math.max(1, number(revisionBudget.validezDias) || 15)));
    setLeadTime(revisionBudget.plazoEstimado || "48–72 hs");
    setWarranty(revisionBudget.garantia || "90 días mano de obra");
    setObservations(revisionBudget.observaciones || "");
    setInternalNote(revisionBudget.notaInterna || "");
    setClientQuery(revisionBudget.cliente || "");

    hydratedRevisionRef.current = true;
  }, [revisionBudget, revisionMode]);

  useEffect(() => {
    if (!revisionMode || !revisionBudget?.clienteId || selectedClient) return;

    const found = clients.find((client) => client.id === revisionBudget.clienteId);
    if (found) {
      setSelectedClient(found);
      setClientQuery(getClientDisplayName(found));
    }
  }, [clients, revisionBudget, revisionMode, selectedClient]);

  const clientSuggestions = useMemo(() => {
    const query = normalize(clientQuery);
    if (query.length < 2) return [];

    return clients
      .filter((client) => client.archivado !== true)
      .filter((client) => {
        const text = [
          getClientDisplayName(client),
          client.dni,
          client.cuit,
          client.tel,
          client.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(query);
      })
      .slice(0, 8);
  }, [clientQuery, clients]);

  const productSuggestions = useMemo(() => {
    const query = normalize(`${itemQuery} ${skuQuery}`);
    if (!query) return [];

    return products
      .filter((product) => product.activo !== false)
      .filter((product) => {
        const text = [
          product.nombre,
          product.sku,
          product.id,
          product.codigoBarras,
          product.categoria,
          product.proveedor,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return query
          .split(/\s+/)
          .filter(Boolean)
          .every((part) => text.includes(part));
      })
      .slice(0, 8);
  }, [itemQuery, products, skuQuery]);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + Math.max(0, number(item.cantidad)) * Math.max(0, number(item.precio)),
      0
    );

    const discount = Math.min(100, Math.max(0, number(discountPercent)));
    const discountAmount = subtotal * (discount / 100);

    return {
      subtotal,
      discount,
      discountAmount,
      total: Math.max(0, subtotal - discountAmount),
    };
  }, [discountPercent, items]);

  const stockIssues = useMemo(() => {
    return items
      .filter((item) => item.sku && normalize(item.tipo) !== "servicio")
      .map((item) => {
        const product = products.find(
          (row) => normalize(row.sku || row.id) === normalize(item.sku)
        );

        if (!product) {
          return {
            item,
            available: null,
            required: number(item.cantidad),
            missingProduct: true,
          };
        }

        const available = availableStock(product);
        const required = Math.max(1, number(item.cantidad));

        return {
          item,
          product,
          available,
          required,
          shortage: required > available,
        };
      })
      .filter((row) => row.missingProduct || row.shortage);
  }, [items, products]);

  const selectedClientName = selectedClient
    ? getClientDisplayName(selectedClient)
    : revisionBudget?.cliente || "Sin seleccionar";

  function selectClient(client) {
    if (client.archivado === true) {
      pushToast("warning", "Cliente archivado", "Restauralo antes de crear el presupuesto.");
      return;
    }

    setSelectedClient(client);
    setClientQuery(getClientDisplayName(client));
    setClientSearchOpen(false);
    setDirty(true);
    pushToast(
      "success",
      "Cliente seleccionado",
      `${getClientDisplayName(client)} quedó vinculado al presupuesto.`
    );
  }

  function handleClientInput(value) {
    setClientQuery(value);
    setClientSearchOpen(value.trim().length >= 2);
    setDirty(true);

    if (
      selectedClient &&
      normalize(value) !== normalize(getClientDisplayName(selectedClient))
    ) {
      setSelectedClient(null);
    }
  }

  function openCreateClient(prefill = "") {
    setNewClient({ ...EMPTY_CLIENT, nombre: prefill.trim() });
    setCreateClientOpen(true);
  }

  async function handleCreateClient() {
    if (creatingClient) return;

    try {
      setCreatingClient(true);
      const created = await createClient({
        ...newClient,
        author,
      });

      selectClient(created);
      setCreateClientOpen(false);
      setNewClient(EMPTY_CLIENT);
      pushToast("success", "Cliente creado", `${getClientDisplayName(created)} quedó dado de alta.`);
    } catch (error) {
      console.error(error);

      if (error?.message === "CLIENT_DUPLICATE" && error?.clientId) {
        const existing = clients.find((client) => client.id === error.clientId);
        if (existing) {
          selectClient(existing);
          setCreateClientOpen(false);
          pushToast("warning", "Cliente existente", "Encontramos un registro coincidente y lo seleccionamos.");
          return;
        }
      }

      pushToast("error", "No se pudo crear el cliente", getErrorMessage(error));
    } finally {
      setCreatingClient(false);
    }
  }

  function addProduct(product) {
    const service = isService(product);
    const available = availableStock(product);

    if (!service && available <= 0) {
      pushToast("warning", "Sin stock disponible", `${product.nombre || product.sku} no tiene unidades disponibles.`);
      return;
    }

    setItems((current) => {
      const sku = normalize(product.sku || product.id);
      const existing = current.find((item) => normalize(item.sku) === sku && sku);

      if (!existing) return [...current, createCatalogItem(product)];

      const nextQuantity = number(existing.cantidad) + 1;
      if (!service && nextQuantity > available) {
        pushToast("warning", "Stock insuficiente", `Disponible para presupuestar: ${available}.`);
        return current;
      }

      return current.map((item) =>
        item.id === existing.id ? { ...item, cantidad: nextQuantity } : item
      );
    });

    setItemQuery("");
    setSkuQuery("");
    setItemSearchOpen(false);
    setDirty(true);
  }

  function handleSkuKeyDown(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();

    const query = normalize(skuQuery);
    const product = products.find(
      (row) =>
        normalize(row.sku || row.id) === query ||
        normalize(row.codigoBarras) === query
    );

    if (product) {
      addProduct(product);
    } else {
      setItemSearchOpen(true);
      pushToast("info", "Código no encontrado", "Podés buscar por descripción o agregar un concepto manual.");
    }
  }

  function addManualConcept() {
    const description = manualItem.descripcion.trim();
    const quantity = Math.max(1, number(manualItem.cantidad));
    const price = Math.max(0, number(manualItem.precio));

    if (!description) {
      pushToast("warning", "Falta la descripción", "Ingresá el concepto que querés presupuestar.");
      return;
    }

    setItems((current) => [
      ...current,
      createManualItem({ descripcion: description, cantidad: quantity, precio: price }),
    ]);
    setManualItem(EMPTY_MANUAL_ITEM);
    setManualItemOpen(false);
    setDirty(true);
    pushToast("success", "Concepto manual agregado", description);
  }

  function updateItem(itemId, field, value) {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: field === "cantidad" || field === "precio" ? value : value,
            }
          : item
      )
    );
    setDirty(true);
  }

  function removeItem(itemId) {
    setItems((current) => current.filter((item) => item.id !== itemId));
    setDirty(true);
  }

  function validateBudget() {
    if (!selectedClient) {
      pushToast("warning", "Falta el cliente", "Buscá un cliente existente o crealo desde esta pantalla.");
      return false;
    }

    if (items.length === 0) {
      pushToast("warning", "Sin conceptos", "Agregá al menos un producto, servicio o concepto manual.");
      return false;
    }

    const invalid = items.some(
      (item) =>
        !String(item.descripcion || "").trim() ||
        number(item.cantidad) <= 0 ||
        number(item.precio) < 0
    );

    if (invalid) {
      pushToast("warning", "Revisá los conceptos", "Descripción, cantidad y precio deben ser válidos.");
      return false;
    }

    if (stockIssues.length > 0) {
      const first = stockIssues[0];
      pushToast(
        "warning",
        first.missingProduct ? "Producto no disponible" : "Stock insuficiente",
        first.missingProduct
          ? `${first.item.descripcion} ya no está disponible en el catálogo.`
          : `${first.item.descripcion}: disponible ${first.available}, requerido ${first.required}.`
      );
      return false;
    }

    if (totals.total <= 0) {
      pushToast("warning", "Total inválido", "El presupuesto debe tener un total mayor que cero.");
      return false;
    }

    if (revisionMode && !revisionReason.trim()) {
      pushToast("warning", "Falta el motivo", "Indicá por qué se genera esta nueva revisión.");
      return false;
    }

    return true;
  }

  function openPreview(printAfter = false) {
    if (!validateBudget()) return;
    setPreviewOpen(true);

    if (printAfter) {
      window.setTimeout(() => window.print(), 250);
    }
  }

  function handleBack() {
    if (dirty && !saving) {
      setDiscardOpen(true);
      return;
    }

    navigate("/facturacion/presupuestos");
  }

  async function saveBudget() {
    if (saving || !validateBudget()) return;

    const normalizedItems = items.map((item) => ({
      productoId: item.productoId || "",
      descripcion: String(item.descripcion || "").trim(),
      cantidad: Math.max(1, number(item.cantidad)),
      precio: Math.max(0, number(item.precio)),
      sku: item.sku || "",
      tipo: item.tipo || (item.sku ? "Producto" : "Concepto manual"),
      origenItem: item.origenItem || (item.sku ? "Catálogo" : "Manual"),
    }));

    try {
      setSaving(true);

      const payload = {
        client: selectedClient,
        items: normalizedItems,
        discountPercent: totals.discount,
        validityDays: Math.max(1, number(validityDays) || 15),
        observations,
        leadTime,
        warranty,
        internalNote,
      };

      const result = revisionMode
        ? await createBudgetRevision(
            revisionId,
            {
              ...payload,
              reason: revisionReason,
            },
            author
          )
        : await createManualBudget({
            ...payload,
            author,
          });

      setDirty(false);
      navigate("/facturacion/presupuestos", {
        replace: true,
        state: {
          budgetId: result.id || result.budgetId,
        },
      });
    } catch (error) {
      console.error(error);
      pushToast(
        "error",
        revisionMode ? "No se pudo crear la revisión" : "No se pudo crear el presupuesto",
        getErrorMessage(error)
      );
    } finally {
      setSaving(false);
    }
  }

  const previewNumber = revisionMode
    ? `${revisionBudget?.numero || revisionBudget?.id || revisionId} · v${Math.max(1, number(revisionBudget?.revision) || 1) + 1}`
    : "BORRADOR · v1";

  if (revisionMode && loadingRevision) {
    return (
      <main className="manual-budget-page loading">
        <div className="manual-budget-loading">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
            <FileText size={28} />
          </motion.div>
          <strong>Cargando revisión</strong>
          <span>{revisionId}</span>
        </div>
      </main>
    );
  }

  return (
    <main className="manual-budget-page">
      <header className="manual-budget-topbar">
        <div className="manual-budget-brand">
          <button type="button" className="manual-icon-button" onClick={handleBack} disabled={saving}>
            <ArrowLeft size={20} />
          </button>

          <motion.div
            className="manual-brand-icon"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          >
            {revisionMode ? <PencilLine size={20} /> : <ClipboardList size={20} />}
          </motion.div>

          <div>
            <strong>{revisionMode ? "Nueva revisión" : "Nuevo presupuesto manual"}</strong>
            <span>
              {revisionMode
                ? `${revisionBudget?.numero || revisionId} · próxima v${Math.max(1, number(revisionBudget?.revision) || 1) + 1}`
                : "Presupuesto independiente · v1"}
            </span>
          </div>
        </div>

        <div className="manual-budget-header-actions">
          <button type="button" onClick={() => openPreview(false)}>
            <Eye size={16} /> Previsualizar
          </button>
          <button type="button" onClick={() => openPreview(true)}>
            <Printer size={16} /> Imprimir
          </button>
          <motion.button
            type="button"
            className="primary"
            whileHover={saving ? undefined : { y: -2 }}
            whileTap={saving ? undefined : { scale: 0.98 }}
            disabled={saving}
            onClick={saveBudget}
          >
            <Save size={16} /> {saving ? "Guardando..." : revisionMode ? "Guardar revisión" : "Guardar presupuesto"}
          </motion.button>
        </div>
      </header>

      <div className="manual-budget-content">
        <section className="manual-budget-intro">
          <div>
            <span>{revisionMode ? "Versionado comercial" : "Operación manual"}</span>
            <h1>{revisionMode ? "Actualizar propuesta" : "Presupuesto independiente"}</h1>
            <p>
              {revisionMode
                ? "La versión anterior se conserva completa para auditoría."
                : "No necesita Ticket. Podés usar catálogo, servicios y conceptos manuales."}
            </p>
          </div>
          <div className="manual-budget-origin-pill">
            <CheckCircle2 size={15} /> {revisionMode ? `Revisión de ${revisionId}` : "Origen manual"}
          </div>
        </section>

        <div className="manual-budget-layout">
          <div className="manual-budget-main">
            <motion.section className="manual-budget-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="manual-card-head">
                <div className="manual-card-title">
                  <div className="manual-card-icon"><UserRound size={18} /></div>
                  <div>
                    <strong>1. Cliente</strong>
                    <span>Buscá por nombre, DNI, CUIT, teléfono o email.</span>
                  </div>
                </div>

                <button type="button" className="manual-soft-button" onClick={() => openCreateClient(clientQuery)}>
                  <UserPlus size={15} /> Crear cliente
                </button>
              </div>

              <div className="manual-card-body">
                {selectedClient ? (
                  <div className="manual-selected-client">
                    <div className="manual-selected-avatar"><UserRound size={18} /></div>
                    <div>
                      <strong>{getClientDisplayName(selectedClient)}</strong>
                      <span>
                        {getClientDocument(selectedClient)} · {selectedClient.tel || "Sin teléfono"} · {selectedClient.email || "Sin email"}
                      </span>
                    </div>
                    <button type="button" onClick={() => {
                      setSelectedClient(null);
                      setClientQuery("");
                      setDirty(true);
                    }}>
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div className="manual-client-search-wrap">
                    <div className="manual-search-input">
                      <Search size={17} />
                      <input
                        type="search"
                        value={clientQuery}
                        onFocus={() => setClientSearchOpen(clientQuery.trim().length >= 2)}
                        onChange={(event) => handleClientInput(event.target.value)}
                        placeholder={loadingClients ? "Cargando clientes..." : "Buscar cliente..."}
                      />
                      {clientQuery && (
                        <button type="button" onClick={() => handleClientInput("")}><X size={14} /></button>
                      )}
                    </div>

                    <AnimatePresence>
                      {clientSearchOpen && clientQuery.trim().length >= 2 && (
                        <motion.div
                          className="manual-client-results"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                        >
                          {clientSuggestions.length > 0 ? (
                            clientSuggestions.map((client) => (
                              <button type="button" key={client.id} onClick={() => selectClient(client)}>
                                <div>
                                  <strong>{getClientDisplayName(client)}</strong>
                                  <span>{getClientDocument(client)} · {client.tel || "Sin teléfono"} · {client.email || "Sin email"}</span>
                                </div>
                                <small>Seleccionar</small>
                              </button>
                            ))
                          ) : (
                            <div className="manual-client-empty">
                              <UserPlus size={23} />
                              <strong>No encontramos ese cliente</strong>
                              <span>Podés crearlo ahora y quedará seleccionado automáticamente.</span>
                              <button type="button" onClick={() => openCreateClient(clientQuery)}>
                                <Plus size={15} /> Crear cliente nuevo
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.section>

            <motion.section className="manual-budget-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
              <div className="manual-card-head">
                <div className="manual-card-title">
                  <div className="manual-card-icon blue"><Package size={18} /></div>
                  <div>
                    <strong>2. Productos y servicios</strong>
                    <span>Usá el catálogo o cargá un concepto manual.</span>
                  </div>
                </div>
                <button type="button" className="manual-soft-button" onClick={() => setManualItemOpen(true)}>
                  <PencilLine size={15} /> Concepto manual
                </button>
              </div>

              <div className="manual-card-body">
                <div className="manual-item-search-row">
                  <div className="manual-search-input">
                    <Search size={17} />
                    <input
                      type="search"
                      value={itemQuery}
                      onFocus={() => setItemSearchOpen(Boolean(itemQuery || skuQuery))}
                      onChange={(event) => {
                        setItemQuery(event.target.value);
                        setItemSearchOpen(Boolean(event.target.value || skuQuery));
                      }}
                      placeholder={loadingProducts ? "Cargando catálogo..." : "Buscar producto o servicio..."}
                    />
                  </div>

                  <div className="manual-sku-input">
                    <Barcode size={17} />
                    <input
                      value={skuQuery}
                      onChange={(event) => {
                        setSkuQuery(event.target.value);
                        setItemSearchOpen(Boolean(event.target.value || itemQuery));
                      }}
                      onKeyDown={handleSkuKeyDown}
                      placeholder="Código / SKU"
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {itemSearchOpen && (itemQuery || skuQuery) && (
                    <motion.div
                      className="manual-product-results"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                    >
                      {productSuggestions.length > 0 ? (
                        productSuggestions.map((product) => {
                          const service = isService(product);
                          const available = availableStock(product);

                          return (
                            <button type="button" key={product.id} onClick={() => addProduct(product)}>
                              <div>
                                <strong>{product.nombre || product.id}</strong>
                                <span>{product.sku || product.id} · {product.categoria || "Sin categoría"}</span>
                              </div>
                              <small className={!service && available <= 0 ? "out" : ""}>
                                {service ? "Servicio" : `${available} disp.`}
                              </small>
                              <b>{money(product.precio)}</b>
                            </button>
                          );
                        })
                      ) : (
                        <div className="manual-product-empty">
                          <Package size={22} />
                          <strong>Sin coincidencias</strong>
                          <span>Probá otro nombre/código o agregá un concepto manual.</span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="manual-items-table">
                  <div className="manual-items-head">
                    <div>Concepto</div>
                    <div>Cant.</div>
                    <div>Precio unit.</div>
                    <div>Subtotal</div>
                    <div />
                  </div>

                  {items.length === 0 ? (
                    <div className="manual-items-empty">
                      <Package size={23} />
                      <strong>Sin conceptos</strong>
                      <span>Agregá productos, servicios o conceptos manuales.</span>
                    </div>
                  ) : (
                    items.map((item) => {
                      const product = item.sku
                        ? products.find((row) => normalize(row.sku || row.id) === normalize(item.sku))
                        : null;
                      const available = product ? availableStock(product) : null;
                      const stockProblem =
                        item.sku &&
                        normalize(item.tipo) !== "servicio" &&
                        (available === null || number(item.cantidad) > available);

                      return (
                        <div className={`manual-item-row ${stockProblem ? "stock-warning" : ""}`} key={item.id}>
                          <div>
                            <strong>{item.descripcion}</strong>
                            <span>
                              {item.sku ? `SKU ${item.sku}` : "Concepto manual"}
                              {available !== null && available !== Infinity ? ` · ${available} disponibles` : ""}
                            </span>
                          </div>

                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.cantidad}
                            onChange={(event) => updateItem(item.id, "cantidad", event.target.value)}
                          />

                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.precio}
                            onChange={(event) => updateItem(item.id, "precio", event.target.value)}
                          />

                          <strong>{money(number(item.cantidad) * number(item.precio))}</strong>

                          <button type="button" onClick={() => removeItem(item.id)} title="Eliminar concepto">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.section>

            <motion.section className="manual-budget-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <div className="manual-card-head">
                <div className="manual-card-title">
                  <div className="manual-card-icon mint"><FileText size={18} /></div>
                  <div>
                    <strong>3. Condiciones comerciales</strong>
                    <span>Se mostrarán en la vista previa y en la impresión.</span>
                  </div>
                </div>
              </div>

              <div className="manual-card-body manual-conditions-grid">
                <label>
                  <span>Vigencia</span>
                  <select value={validityDays} onChange={(event) => { setValidityDays(event.target.value); setDirty(true); }}>
                    <option value="7">7 días</option>
                    <option value="10">10 días</option>
                    <option value="15">15 días</option>
                    <option value="30">30 días</option>
                  </select>
                </label>

                <label>
                  <span>Descuento %</span>
                  <input type="number" min="0" max="100" step="0.5" value={discountPercent} onChange={(event) => { setDiscountPercent(event.target.value); setDirty(true); }} />
                </label>

                <label>
                  <span>Plazo estimado</span>
                  <input value={leadTime} onChange={(event) => { setLeadTime(event.target.value); setDirty(true); }} />
                </label>

                <label>
                  <span>Garantía</span>
                  <input value={warranty} onChange={(event) => { setWarranty(event.target.value); setDirty(true); }} />
                </label>

                {revisionMode && (
                  <label className="wide revision-reason">
                    <span>Motivo de la nueva revisión *</span>
                    <textarea value={revisionReason} onChange={(event) => { setRevisionReason(event.target.value); setDirty(true); }} placeholder="Ej.: cambio de cantidades, actualización de precio, nueva condición comercial..." />
                  </label>
                )}

                <label className="wide">
                  <span>Observaciones visibles para el cliente</span>
                  <textarea value={observations} onChange={(event) => { setObservations(event.target.value); setDirty(true); }} placeholder="Detalle del trabajo, aclaraciones y condiciones especiales..." />
                </label>

                <label className="wide internal-note">
                  <span>Nota interna</span>
                  <textarea value={internalNote} onChange={(event) => { setInternalNote(event.target.value); setDirty(true); }} placeholder="Uso interno. No se imprime ni se comparte con el cliente." />
                </label>
              </div>
            </motion.section>
          </div>

          <aside className="manual-budget-summary-card">
            <div className="manual-summary-head">
              <div>
                <span>Resumen comercial</span>
                <h3>{revisionMode ? `${revisionId} · nueva revisión` : "Presupuesto manual"}</h3>
              </div>
              <span className="manual-draft-badge">{revisionMode ? "Revisión" : "Borrador"}</span>
            </div>

            <div className="manual-summary-body">
              <div className="manual-summary-client">
                <span>Cliente</span>
                <strong>{selectedClientName}</strong>
                <small>{selectedClient ? getClientDocument(selectedClient) : revisionBudget?.doc || "—"}</small>
              </div>

              <div className="manual-summary-lines">
                <div><span>Conceptos</span><strong>{items.length}</strong></div>
                <div><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
                <div><span>Descuento {totals.discount}%</span><strong>− {money(totals.discountAmount)}</strong></div>
                <div className="total"><span>Total</span><strong>{money(totals.total)}</strong></div>
              </div>

              {stockIssues.length > 0 && (
                <div className="manual-stock-alert">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>Revisá la disponibilidad</strong>
                    <span>{stockIssues.length} concepto(s) con problema de stock o catálogo.</span>
                  </div>
                </div>
              )}

              <div className="manual-summary-note">
                El presupuesto no cobra ni factura. Si es aceptado, el pago se registra en Caja. Los productos con SKU se reservan al momento de la aceptación.
              </div>

              <div className="manual-summary-actions">
                <button type="button" onClick={() => openPreview(false)}><Eye size={15} /> Previsualizar</button>
                <button type="button" onClick={() => openPreview(true)}><Printer size={15} /> Imprimir</button>
                <motion.button type="button" className="primary" disabled={saving} whileHover={saving ? undefined : { y: -2 }} onClick={saveBudget}>
                  <Save size={15} /> {saving ? "Guardando..." : revisionMode ? "Guardar revisión" : "Guardar presupuesto"}
                </motion.button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {previewOpen && (
          <motion.section className="manual-preview-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <header className="manual-preview-toolbar no-print">
              <div>
                <button type="button" className="manual-icon-button" onClick={() => setPreviewOpen(false)}><ArrowLeft size={20} /></button>
                <div>
                  <strong>Vista previa</strong>
                  <span>{previewNumber}</span>
                </div>
              </div>
              <div>
                <button type="button" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
                <button type="button" className="primary" disabled={saving} onClick={saveBudget}><Save size={16} /> Guardar</button>
              </div>
            </header>

            <div className="manual-preview-scroll">
              <motion.article className="manual-print-document" initial={{ opacity: 0, y: 14, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
                <div className="manual-print-head">
                  <div className="manual-print-company">
                    <div><FileText size={24} /></div>
                    <section><strong>SERVIX</strong><span>Servicio técnico · Soluciones informáticas</span><span>Presupuesto comercial</span></section>
                  </div>
                  <div className="manual-print-number">
                    <span>Presupuesto</span>
                    <strong>{previewNumber}</strong>
                    <small>{revisionMode ? "Nueva revisión" : "Borrador sin guardar"}</small>
                  </div>
                </div>

                <div className="manual-print-info">
                  <section>
                    <span>Cliente</span>
                    <strong>{selectedClientName}</strong>
                    <small>{selectedClient ? getClientDocument(selectedClient) : revisionBudget?.doc || "C.F."}</small>
                    <small>Origen: {revisionMode ? normalize(revisionBudget?.origen) === "ticket" ? `Ticket ${revisionBudget?.ticketNumero || revisionBudget?.ticketId}` : "Manual" : "Manual"}</small>
                  </section>
                  <section>
                    <span>Información</span>
                    <strong>Fecha: {new Date().toLocaleDateString("es-AR")}</strong>
                    <small>Vigencia: {validityDays} días</small>
                    <small>Responsable: {author}</small>
                  </section>
                </div>

                <div className="manual-print-table">
                  <div className="manual-print-table-head"><div>Descripción</div><div>Cant.</div><div>Unitario</div><div>Subtotal</div></div>
                  {items.map((item) => (
                    <div className="manual-print-row" key={item.id}>
                      <div><strong>{item.descripcion}</strong><small>{item.sku ? `SKU ${item.sku}` : "Concepto manual"}</small></div>
                      <div>{number(item.cantidad)}</div>
                      <div>{money(item.precio)}</div>
                      <div>{money(number(item.cantidad) * number(item.precio))}</div>
                    </div>
                  ))}
                </div>

                <div className="manual-print-totals">
                  <div><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
                  <div><span>Descuento {totals.discount}%</span><strong>− {money(totals.discountAmount)}</strong></div>
                  <div className="grand"><span>Total presupuestado</span><strong>{money(totals.total)}</strong></div>
                </div>

                <section className="manual-print-conditions">
                  <h3>Condiciones comerciales</h3>
                  <div>
                    <article><span>Validez</span><strong>{validityDays} días</strong></article>
                    <article><span>Plazo estimado</span><strong>{leadTime || "A coordinar"}</strong></article>
                    <article><span>Garantía</span><strong>{warranty || "Según trabajo realizado"}</strong></article>
                    <article><span>Forma de pago</span><strong>Se define al momento del cobro en Caja</strong></article>
                  </div>
                </section>

                {observations && <div className="manual-print-observations"><strong>Observaciones</strong><p>{observations}</p></div>}

                <div className="manual-print-note">
                  Este documento constituye una propuesta comercial y no acredita pago. La disponibilidad se valida antes de guardar y nuevamente al aceptar. Los cobros se registran en Caja.
                </div>

                <div className="manual-print-signatures"><div>Firma / conformidad del cliente</div><div>SERVIX · Responsable</div></div>
              </motion.article>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {createClientOpen && (
          <div className="manual-modal-overlay" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creatingClient) setCreateClientOpen(false);
          }}>
            <motion.div className="manual-modal" initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}>
              <div className="manual-modal-head">
                <div><UserPlus size={20} /><section><strong>Crear cliente</strong><span>Quedará seleccionado automáticamente.</span></section></div>
                <button type="button" onClick={() => setCreateClientOpen(false)}><X size={16} /></button>
              </div>

              <div className="manual-modal-grid">
                <label><span>Nombre / Razón social *</span><input value={newClient.nombre} onChange={(event) => setNewClient((current) => ({ ...current, nombre: event.target.value }))} /></label>
                <label><span>Apellido</span><input value={newClient.apellido} onChange={(event) => setNewClient((current) => ({ ...current, apellido: event.target.value }))} /></label>
                <label><span>DNI</span><input value={newClient.dni} onChange={(event) => setNewClient((current) => ({ ...current, dni: event.target.value }))} /></label>
                <label><span>CUIT</span><input value={newClient.cuit} onChange={(event) => setNewClient((current) => ({ ...current, cuit: event.target.value }))} /></label>
                <label><span>Teléfono</span><input value={newClient.tel} onChange={(event) => setNewClient((current) => ({ ...current, tel: event.target.value }))} /></label>
                <label><span>Email</span><input type="email" value={newClient.email} onChange={(event) => setNewClient((current) => ({ ...current, email: event.target.value }))} /></label>
                <label className="wide"><span>Dirección</span><input value={newClient.direccion} onChange={(event) => setNewClient((current) => ({ ...current, direccion: event.target.value }))} /></label>
              </div>

              <div className="manual-modal-note">SERVIX valida duplicados por DNI, CUIT, teléfono y email antes de crear el cliente.</div>

              <div className="manual-modal-actions">
                <button type="button" disabled={creatingClient} onClick={() => setCreateClientOpen(false)}>Cancelar</button>
                <button type="button" className="primary" disabled={creatingClient} onClick={handleCreateClient}>{creatingClient ? "Creando..." : "Crear y seleccionar"}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {manualItemOpen && (
          <div className="manual-modal-overlay" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setManualItemOpen(false);
          }}>
            <motion.div className="manual-modal small" initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}>
              <div className="manual-modal-head">
                <div><PencilLine size={20} /><section><strong>Concepto manual</strong><span>No afecta stock.</span></section></div>
                <button type="button" onClick={() => setManualItemOpen(false)}><X size={16} /></button>
              </div>

              <div className="manual-modal-grid">
                <label className="wide"><span>Descripción *</span><input value={manualItem.descripcion} onChange={(event) => setManualItem((current) => ({ ...current, descripcion: event.target.value }))} /></label>
                <label><span>Cantidad</span><input type="number" min="1" value={manualItem.cantidad} onChange={(event) => setManualItem((current) => ({ ...current, cantidad: event.target.value }))} /></label>
                <label><span>Precio unitario</span><input type="number" min="0" value={manualItem.precio} onChange={(event) => setManualItem((current) => ({ ...current, precio: event.target.value }))} /></label>
              </div>

              <div className="manual-modal-actions">
                <button type="button" onClick={() => setManualItemOpen(false)}>Cancelar</button>
                <button type="button" className="primary" onClick={addManualConcept}>Agregar concepto</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {discardOpen && (
          <div className="manual-modal-overlay">
            <motion.div className="manual-modal small" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
              <div className="manual-modal-head">
                <div><AlertTriangle size={20} /><section><strong>Descartar cambios</strong><span>Hay información sin guardar.</span></section></div>
              </div>
              <p className="manual-discard-copy">Si volvés ahora, los cambios de este presupuesto se perderán.</p>
              <div className="manual-modal-actions">
                <button type="button" onClick={() => setDiscardOpen(false)}>Seguir editando</button>
                <button type="button" className="danger" onClick={() => navigate("/facturacion/presupuestos")}>Descartar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="manual-toast-area" aria-live="polite">
        <AnimatePresence>
          {toasts.map((toast) => (
            <AuroraToast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
          ))}
        </AnimatePresence>
      </div>
    </main>
  );
}
