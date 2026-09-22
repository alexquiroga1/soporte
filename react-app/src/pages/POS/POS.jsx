import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  motion,
} from "motion/react";

import {
  ArrowLeft,
  BadgePercent,
  Boxes,
  CheckCircle2,
  ChevronRight,
  History,
  Minus,
  Package,
  PauseCircle,
  Plus,
  ReceiptText,
  ScanBarcode,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  UserPlus,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import {
  calculatePosTotals,
  getClientDisplayName,
  sendPosSaleToCash,
  subscribeToPosBusiness,
  subscribeToPosClients,
  subscribeToPosProducts,
  subscribeToPosPromotions,
  subscribeToPosSales,
} from "../../services/pos.service.js";

import {
  createClient,
} from "../../services/clientes.service.js";

import {
  notify,
} from "../../services/notifications.js";

import "./POS.css";

const CART_STORAGE_PREFIX = "servix_cart_react_";
const LEGACY_CART_STORAGE_KEY = "servix_cart_temp_react";

const EMPTY_NEW_CLIENT = {
  nombre: "",
  apellido: "",
  dni: "",
  cuit: "",
  tel: "",
  email: "",
};

const EMPTY_MANUAL_ITEM = {
  nombre: "",
  codigo: "",
  cantidad: "1",
  precio: "",
};

/* =========================================
   HELPERS
========================================= */

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";

  const parts = String(value).split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value;
}

function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getClientSearchText(client) {
  return normalizeSearch(
    [
      getClientDisplayName(client, ""),
      client?.dni,
      client?.cuit,
      client?.tel,
      client?.telefono,
      client?.email,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function getClientMeta(client) {
  if (!client) return "";

  const values = [
    client.dni ? `DNI ${client.dni}` : "",
    client.cuit ? `CUIT ${client.cuit}` : "",
    client.tel && client.tel !== "—" ? client.tel : "",
    client.email && client.email !== "—" ? client.email : "",
  ].filter(Boolean);

  return values.join(" · ") || "Cliente registrado";
}

function getProductStatus(product) {
  const service = product?.categoria === "Servicios";
  const stock = Math.max(0, Number(product?.stock || 0));
  const reserved = Math.max(0, Number(product?.stockReservado || 0));
  const availableStock = Math.max(0, stock - reserved);
  const stockMax = Math.max(1, Number(product?.stockMax || 0));

  if (service) {
    return {
      label: "Servicio",
      className: "pos-stock-service",
      available: true,
      availableStock: Number.POSITIVE_INFINITY,
    };
  }

  if (availableStock <= 0) {
    return {
      label: reserved > 0 ? "Sin libre" : "Agotado",
      className: "pos-stock-out",
      available: false,
      availableStock: 0,
    };
  }

  if (availableStock / stockMax < 0.25 || availableStock <= 3) {
    return {
      label: `Bajo · ${availableStock}`,
      className: "pos-stock-low",
      available: true,
      availableStock,
    };
  }

  return {
    label: `${availableStock} disp.`,
    className: "pos-stock-ok",
    available: true,
    availableStock,
  };
}

function salePaymentClass(method) {
  switch (method) {
    case "Efectivo":
      return "pos-payment-cash";
    case "Tarjeta":
      return "pos-payment-card";
    case "Transferencia":
    case "Mercado Pago":
      return "pos-payment-transfer";
    case "Préstamo personal":
      return "pos-payment-credit";
    case "Saldo a Favor":
      return "pos-payment-balance";
    default:
      return "pos-payment-neutral";
  }
}

function getCartStorageKey(uid) {
  return `${CART_STORAGE_PREFIX}${uid || "anonymous"}`;
}

function readInitialCart(uid) {
  try {
    const scopedKey = getCartStorageKey(uid);
    const scopedValue = localStorage.getItem(scopedKey);
    const legacyValue = uid ? localStorage.getItem(LEGACY_CART_STORAGE_KEY) : null;
    const parsed = JSON.parse(scopedValue || legacyValue || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* =========================================
   COMPONENTE
========================================= */

export default function POS() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const author =
    profile?.nombre ||
    profile?.name ||
    user?.email ||
    "Mostrador";

  const [products, setProducts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [clients, setClients] = useState([]);
  const [sales, setSales] = useState([]);
  const [business, setBusiness] = useState({ impuesto: 21 });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [codeSearch, setCodeSearch] = useState("");
  const [activeTab, setActiveTab] = useState("sale");

  const cartStorageKey = useMemo(
    () => getCartStorageKey(user?.uid),
    [user?.uid]
  );

  const [cart, setCart] = useState(() => readInitialCart(user?.uid));
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientQuery, setClientQuery] = useState("");
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [customerMode, setCustomerMode] = useState("consumer");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [selectedPromotionId, setSelectedPromotionId] = useState("");
  const [sending, setSending] = useState(false);

  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState(EMPTY_NEW_CLIENT);
  const [savingNewClient, setSavingNewClient] = useState(false);

  const [manualItemOpen, setManualItemOpen] = useState(false);
  const [manualItemForm, setManualItemForm] = useState(EMPTY_MANUAL_ITEM);

  /* =======================================
     FIRESTORE
  ======================================= */

  useEffect(() => {
    let productsReady = false;
    let clientsReady = false;

    const updateLoading = () => {
      if (productsReady && clientsReady) {
        setLoading(false);
      }
    };

    const unsubscribeProducts = subscribeToPosProducts(
      (data) => {
        setProducts(data);
        productsReady = true;
        updateLoading();
      },
      (error) => {
        console.error(error);
        productsReady = true;
        updateLoading();
        notify.error(
          "No pudimos cargar el catálogo",
          "Revisá la conexión o los permisos de Firestore."
        );
      }
    );

    const unsubscribePromotions = subscribeToPosPromotions(
      setPromotions,
      (error) => {
        console.error(error);
        notify.warning(
          "Promociones no disponibles",
          "El POS seguirá funcionando con descuento manual."
        );
      }
    );

    const unsubscribeClients = subscribeToPosClients(
      (data) => {
        setClients(data);
        clientsReady = true;
        updateLoading();
      },
      (error) => {
        console.error(error);
        clientsReady = true;
        updateLoading();
      }
    );

    const unsubscribeSales = subscribeToPosSales(
      setSales,
      (error) => console.error(error)
    );

    const unsubscribeBusiness = subscribeToPosBusiness(
      setBusiness,
      (error) => console.error(error)
    );

    return () => {
      unsubscribeProducts();
      unsubscribePromotions();
      unsubscribeClients();
      unsubscribeSales();
      unsubscribeBusiness();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));

    if (user?.uid) {
      localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
    }
  }, [cart, cartStorageKey, user?.uid]);

  /* =======================================
     BÚSQUEDA
  ======================================= */

  const lookupText = search.trim().toLowerCase();
  const lookupCode = codeSearch.trim().toLowerCase();
  const lookupActive = Boolean(lookupText || lookupCode);

  const filteredProducts = useMemo(() => {
    if (!lookupActive) return [];

    return products.filter((product) => {
      const name = String(product?.nombre || "").toLowerCase();
      const sku = String(product?.sku || "").toLowerCase();
      const category = String(product?.categoria || "").toLowerCase();

      const matchesText =
        !lookupText ||
        name.includes(lookupText) ||
        sku.includes(lookupText) ||
        category.includes(lookupText);

      const matchesCode =
        !lookupCode ||
        sku.includes(lookupCode);

      return matchesText && matchesCode;
    });
  }, [products, lookupActive, lookupText, lookupCode]);

  /* =======================================
     CLIENTE / DESCUENTO
  ======================================= */

  const filteredClients = useMemo(() => {
    const query = normalizeSearch(clientQuery);

    if (!query || customerMode === "registered") {
      return [];
    }

    return clients
      .filter((client) => getClientSearchText(client).includes(query))
      .slice(0, 8);
  }, [clients, clientQuery, customerMode]);

  const selectClient = (client) => {
    setSelectedClient(client);
    setClientQuery(getClientDisplayName(client, ""));
    setCustomerMode("registered");
    setClientSearchOpen(false);
  };

  const useConsumerFinal = () => {
    setSelectedClient(null);
    setClientQuery("");
    setCustomerMode("consumer");
    setClientSearchOpen(false);
  };

  const handleClientQueryChange = (value) => {
    setClientQuery(value);
    setSelectedClient(null);
    setCustomerMode(value.trim() ? "search" : "consumer");
    setClientSearchOpen(Boolean(value.trim()));
  };

  const openNewClient = () => {
    const words = clientQuery.trim().split(/\s+/).filter(Boolean);

    setNewClientForm({
      ...EMPTY_NEW_CLIENT,
      nombre: words[0] || "",
      apellido: words.slice(1).join(" "),
    });
    setNewClientOpen(true);
    setClientSearchOpen(false);
  };

  const updateNewClientField = (field, value) => {
    setNewClientForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleCreateClient = async () => {
    const name = newClientForm.nombre.trim();

    if (!name) {
      notify.warning(
        "Nombre requerido",
        "Ingresá al menos el nombre del cliente."
      );
      return;
    }

    try {
      setSavingNewClient(true);

      const created = await createClient({
        ...newClientForm,
        limiteCredito: 0,
        author,
      });

      setSelectedClient(created);
      setClientQuery(getClientDisplayName(created, ""));
      setCustomerMode("registered");
      setClientSearchOpen(false);
      setNewClientOpen(false);
      setNewClientForm(EMPTY_NEW_CLIENT);

      notify.success(
        "Cliente creado",
        `${getClientDisplayName(created)} quedó seleccionado para esta venta.`
      );
    } catch (error) {
      console.error(error);

      if (error?.message === "CLIENT_DUPLICATE") {
        const existing = clients.find(
          (client) => client.id === error?.clientId
        );

        if (existing) {
          selectClient(existing);
          setNewClientOpen(false);
          notify.info(
            "Cliente ya registrado",
            "SERVIX seleccionó el cliente existente."
          );
          return;
        }

        notify.warning(
          "Cliente ya registrado",
          "Ya existe un cliente con el mismo DNI, CUIT, teléfono o email."
        );
        return;
      }

      notify.error(
        "No se pudo crear el cliente",
        error?.message || "Revisá los datos e intentá nuevamente."
      );
    } finally {
      setSavingNewClient(false);
    }
  };

  const normalizedDiscountPercent = useMemo(() => {
    const parsed = Number(discountPercent || 0);
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(100, Math.max(0, parsed));
  }, [discountPercent]);

  const manualDiscount = useMemo(() => {
    if (normalizedDiscountPercent <= 0) return null;

    return {
      nombre: `Descuento manual ${normalizedDiscountPercent}%`,
      tipo: "Porcentaje",
      valor: normalizedDiscountPercent,
      aplicaA: "Todos",
      activa: true,
    };
  }, [normalizedDiscountPercent]);

  const selectedPromotion = useMemo(
    () => promotions.find((promotion) => promotion.id === selectedPromotionId) || null,
    [promotions, selectedPromotionId]
  );

  const activePromotion = selectedPromotion || manualDiscount;

  /* =======================================
     TOTALES
  ======================================= */

  const taxRate = Number(business?.impuesto ?? 21) || 0;

  const totals = useMemo(
    () =>
      calculatePosTotals({
        cart,
        promotion: activePromotion,
        taxRate,
      }),
    [cart, activePromotion, taxRate]
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.cantidad || 0), 0),
    [cart]
  );

  /* =======================================
     CARRITO
  ======================================= */

  const addToCart = (product) => {
    const status = getProductStatus(product);

    if (!status.available) {
      notify.warning("Sin stock", `${product.nombre} está agotado.`);
      return;
    }

    setCart((current) => {
      const existing = current.find(
        (item) => item.sku === product.sku && item.manual !== true
      );

      if (existing) {
        const nextQuantity = Number(existing.cantidad || 0) + 1;

        if (
          product.categoria !== "Servicios" &&
          nextQuantity > status.availableStock
        ) {
          notify.warning(
            "Sin más stock",
            `Disponibles: ${status.availableStock}.`
          );
          return current;
        }

        return current.map((item) =>
          item.sku === product.sku && item.manual !== true
            ? { ...item, cantidad: nextQuantity }
            : item
        );
      }

      return [
        ...current,
        {
          productId: product.docId || product.id || product.sku,
          docId: product.docId || product.id || product.sku,
          sku: product.sku,
          nombre: product.nombre,
          categoria: product.categoria,
          precio: Number(product.precio || 0),
          cantidad: 1,
        },
      ];
    });
  };

  const openManualItem = () => {
    setManualItemForm(EMPTY_MANUAL_ITEM);
    setManualItemOpen(true);
  };

  const updateManualItemField = (field, value) => {
    setManualItemForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleAddManualItem = () => {
    const nombre = manualItemForm.nombre.trim();
    const cantidad = Math.max(
      1,
      Math.trunc(Number(manualItemForm.cantidad || 1))
    );
    const precio = Number(manualItemForm.precio || 0);

    if (!nombre) {
      notify.warning(
        "Descripción requerida",
        "Ingresá una descripción para el concepto manual."
      );
      return;
    }

    if (!Number.isFinite(precio) || precio <= 0) {
      notify.warning(
        "Precio inválido",
        "Ingresá un precio unitario mayor que cero."
      );
      return;
    }

    const typedCode = manualItemForm.codigo.trim();
    const generatedCode =
      `MAN-${Date.now().toString(36).toUpperCase()}`;
    const sku = typedCode || generatedCode;

    setCart((current) => [
      ...current,
      {
        productId: null,
        sku,
        nombre,
        categoria: "Servicios",
        precio,
        cantidad,
        manual: true,
      },
    ]);

    setManualItemOpen(false);
    setManualItemForm(EMPTY_MANUAL_ITEM);

    notify.success(
      "Concepto agregado",
      `${nombre} se agregó como concepto manual.`
    );
  };

  const handleCodeKeyDown = (event) => {
    if (event.key !== "Enter") return;

    const code = codeSearch.trim().toLowerCase();
    if (!code) return;

    const exactProduct = products.find(
      (product) => String(product?.sku || "").trim().toLowerCase() === code
    );

    if (!exactProduct) {
      notify.warning("Código no encontrado", `No existe un producto con SKU ${codeSearch.trim()}.`);
      return;
    }

    addToCart(exactProduct);
    setCodeSearch("");
  };

  const changeQuantity = (item, itemIndex, delta) => {
    const product = item.manual
      ? null
      : products.find((row) => row.sku === item.sku);

    setCart((current) => {
      const target = current[itemIndex];
      if (!target) return current;

      const nextQuantity = Number(target.cantidad || 0) + delta;

      if (nextQuantity <= 0) {
        return current.filter((_, index) => index !== itemIndex);
      }

      const productStatus = product ? getProductStatus(product) : null;

      if (
        product &&
        product.categoria !== "Servicios" &&
        nextQuantity > Number(productStatus?.availableStock || 0)
      ) {
        notify.warning(
          "Sin más stock",
          `Disponibles: ${Number(productStatus?.availableStock || 0)}.`
        );
        return current;
      }

      return current.map((row, index) =>
        index === itemIndex
          ? { ...row, cantidad: nextQuantity }
          : row
      );
    });
  };

  const removeFromCart = (itemIndex) => {
    setCart((current) =>
      current.filter((_, index) => index !== itemIndex)
    );
  };

  const clearCart = () => {
    if (!cart.length) return;

    const confirmed = window.confirm("¿Vaciar toda la venta actual?");
    if (!confirmed) return;

    setCart([]);
    setDiscountPercent("0");
    setSelectedPromotionId("");
  };

  /* =======================================
     ENVIAR A CAJA
  ======================================= */

  const handleCheckout = async () => {
    if (!cart.length || sending) return;

    if (
      customerMode === "search" &&
      clientQuery.trim() &&
      !selectedClient
    ) {
      notify.warning(
        "Seleccioná el cliente",
        "Elegí una coincidencia, dalo de alta o usá Consumidor final."
      );
      return;
    }

    try {
      setSending(true);

      const result = await sendPosSaleToCash({
        cart,
        client: selectedClient,
        promotion: activePromotion,
        taxRate,
        author,
      });

      setCart([]);
      setDiscountPercent("0");
      setSelectedPromotionId("");
      setSelectedClient(null);
      setClientQuery("");
      setCustomerMode("consumer");
      localStorage.removeItem(cartStorageKey);

      notify.success(
        "Venta enviada a Caja",
        `${result.folio} quedó pendiente de cobro por ${formatMoney(result.total)}.`
      );

      navigate("/caja");
    } catch (error) {
      console.error(error);

      const messages = {
        POS_CART_EMPTY: "Agregá al menos un producto o servicio.",
        POS_PRODUCT_INVALID: "Hay un artículo inválido en la venta.",
        POS_TOTAL_INVALID: "El total de la venta no es válido.",
        POS_PRODUCT_NOT_FOUND: `No encontramos ${error?.productName || "un producto"} en Firestore.`,
        POS_STOCK_INSUFFICIENT: `Stock insuficiente para ${error?.productName || "un producto"}. Disponible: ${error?.available ?? 0}.`,
        PRODUCT_REFERENCE_AMBIGUOUS: `Hay más de un producto con el SKU ${error?.sku || "indicado"}. Corregí el catálogo antes de continuar.`,
        POS_PENDING_EXISTS: "La venta ya fue enviada a Caja.",
      };

      notify.error(
        "No se pudo enviar a Caja",
        messages[error?.message] || error?.message || "Ocurrió un error inesperado."
      );
    } finally {
      setSending(false);
    }
  };

  /* =======================================
     HISTORIAL
  ======================================= */

  /* =========================================
     RENDER
  ========================================= */

  return (
    <main className="pos-page">
      <header className="pos-header">
        <div className="pos-header-left">
          <button
            type="button"
            className="pos-back"
            onClick={() => navigate("/dashboard")}
            aria-label="Volver al Dashboard"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="pos-header-icon">
            <ShoppingCart size={21} />
          </div>

          <div className="pos-header-copy">
            <strong>Punto de Venta</strong>
            <span>SERVIX · Preparación de venta para Caja</span>
          </div>
        </div>

        <div className="pos-header-actions">
          <div className="pos-header-status">
            <span />
            <div>
              <strong>POS conectado</strong>
              <small>Catálogo en tiempo real</small>
            </div>
          </div>

          <button
            type="button"
            className={`pos-history-toggle ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab(activeTab === "history" ? "sale" : "history")}
          >
            <History size={16} />
            Historial
          </button>
        </div>
      </header>

      <div className="pos-content">
        {activeTab === "sale" ? (
          <>
            <motion.section
              className="pos-intro"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div>
                <span className="pos-kicker">Punto de venta</span>
                <h1>Preparar venta</h1>
                <p>
                  Buscá productos por nombre o código, aplicá un descuento porcentual
                  y enviá la operación a Caja. El cobro se realiza únicamente en Caja.
                </p>
              </div>

              <button
                type="button"
                className="pos-pause"
                onClick={() => notify.success(
                  "Venta pausada",
                  "El carrito queda guardado en este equipo para continuar después."
                )}
              >
                <PauseCircle size={17} />
                Pausar venta
              </button>
            </motion.section>

            <div className="pos-sale-layout">
              <section className="pos-main-column">
                <article className={`pos-card pos-client-card ${clientSearchOpen ? "search-open" : ""}`}>
                  <div className="pos-card-heading">
                    <div className="pos-card-title">
                      <span className="pos-card-icon pos-card-icon-client">
                        <UserRound size={18} />
                      </span>
                      <div>
                        <strong>Cliente</strong>
                        <small>Venta directa: no necesita tener Ticket previo</small>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="pos-inline-client-create"
                      onClick={openNewClient}
                      disabled={savingNewClient}
                    >
                      <UserPlus size={15} />
                      Dar de alta
                    </button>
                  </div>

                  <div className="pos-card-body">
                    <div className="pos-client-search-row">
                      <label className="pos-search-field pos-client-search-field">
                        <Search size={17} />
                        <input
                          type="search"
                          placeholder="Nombre, DNI, CUIT, teléfono o email..."
                          value={clientQuery}
                          onFocus={() => {
                            if (
                              clientQuery.trim() &&
                              customerMode !== "registered"
                            ) {
                              setClientSearchOpen(true);
                            }
                          }}
                          onChange={(event) =>
                            handleClientQueryChange(event.target.value)
                          }
                        />
                        {clientQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setClientQuery("");
                              setSelectedClient(null);
                              setCustomerMode("consumer");
                              setClientSearchOpen(false);
                            }}
                            title="Limpiar cliente"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </label>

                      <button
                        type="button"
                        className={`pos-consumer-button ${customerMode === "consumer" ? "active" : ""}`}
                        onClick={useConsumerFinal}
                      >
                        <UserRound size={15} />
                        Consumidor final
                      </button>
                    </div>

                    {selectedClient && customerMode === "registered" && (
                      <div className="pos-selected-client">
                        <div className="pos-selected-client-avatar">
                          {getClientDisplayName(selectedClient)
                            .split(/\s+/)
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")
                            .toUpperCase()}
                        </div>

                        <div className="pos-selected-client-copy">
                          <span>Cliente seleccionado</span>
                          <strong>{getClientDisplayName(selectedClient)}</strong>
                          <small>{getClientMeta(selectedClient)}</small>
                        </div>

                        <button
                          type="button"
                          onClick={useConsumerFinal}
                          title="Quitar cliente"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    )}

                    {customerMode === "consumer" && !selectedClient && (
                      <div className="pos-consumer-note">
                        <CheckCircle2 size={16} />
                        <div>
                          <strong>Venta directa habilitada</strong>
                          <span>
                            Podés vender sin Ticket y sin cliente registrado.
                            Si el comprador ya existe, buscalo arriba para mantener su historial.
                          </span>
                        </div>
                      </div>
                    )}

                    {clientSearchOpen && customerMode === "search" && (
                      <div className="pos-client-results">
                        {filteredClients.length > 0 ? (
                          filteredClients.map((client) => (
                            <button
                              type="button"
                              key={client.id}
                              onClick={() => selectClient(client)}
                            >
                              <span className="pos-client-result-avatar">
                                {getClientDisplayName(client)
                                  .split(/\s+/)
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((part) => part[0])
                                  .join("")
                                  .toUpperCase()}
                              </span>

                              <span className="pos-client-result-copy">
                                <strong>{getClientDisplayName(client)}</strong>
                                <small>{getClientMeta(client)}</small>
                              </span>

                              <ChevronRight size={16} />
                            </button>
                          ))
                        ) : (
                          <div className="pos-client-no-results">
                            <UserPlus size={18} />
                            <div>
                              <strong>No encontramos ese cliente</strong>
                              <span>
                                Podés darlo de alta ahora y quedará seleccionado automáticamente.
                              </span>
                            </div>
                            <button type="button" onClick={openNewClient}>
                              <UserPlus size={14} />
                              Dar de alta
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </article>

                <article className="pos-card pos-search-card">
                  <div className="pos-card-heading">
                    <div className="pos-card-title">
                      <span className="pos-card-icon pos-card-icon-search">
                        <Search size={18} />
                      </span>
                      <div>
                        <strong>Buscar producto o servicio</strong>
                        <small>La lista aparece solo cuando escribís o ingresás un código</small>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="pos-manual-concept-button"
                      onClick={openManualItem}
                    >
                      <Plus size={15} />
                      Concepto manual
                    </button>
                  </div>

                  <div className="pos-card-body">
                    <div className="pos-lookup-grid">
                      <label className="pos-search-field">
                        <Search size={17} />
                        <input
                          type="search"
                          placeholder="Ej.: SSD Kingston, mantenimiento, RAM..."
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                        />
                        {search && (
                          <button type="button" onClick={() => setSearch("")}>
                            <X size={14} />
                          </button>
                        )}
                      </label>

                      <label className="pos-search-field pos-code-field">
                        <ScanBarcode size={17} />
                        <input
                          type="search"
                          placeholder="Código / SKU"
                          value={codeSearch}
                          onChange={(event) => setCodeSearch(event.target.value)}
                          onKeyDown={handleCodeKeyDown}
                        />
                        {codeSearch && (
                          <button type="button" onClick={() => setCodeSearch("")}>
                            <X size={14} />
                          </button>
                        )}
                      </label>
                    </div>

                    <div className="pos-search-hint">
                      <ScanBarcode size={15} />
                      <span>
                        Si escribís o escaneás un SKU exacto, presioná Enter para agregarlo directamente.
                      </span>
                    </div>

                    <div className="pos-results-shell">
                      {!lookupActive ? (
                        <div className="pos-state pos-state-compact">
                          <Search size={24} />
                          <strong>Empezá a buscar</strong>
                          <span>El catálogo no ocupa pantalla hasta que lo necesitás.</span>
                        </div>
                      ) : loading ? (
                        <div className="pos-state pos-state-compact">
                          <div className="pos-loader" />
                          <strong>Cargando catálogo...</strong>
                        </div>
                      ) : filteredProducts.length === 0 ? (
                        <div className="pos-state pos-state-compact">
                          <Package size={24} />
                          <strong>Sin resultados</strong>
                          <span>
                            Probá con otro nombre o código, o agregalo como concepto manual.
                          </span>
                        </div>
                      ) : (
                        <div className="pos-results-table-wrap">
                          <div className="pos-results-head">
                            <span>Código</span>
                            <span>Producto / servicio</span>
                            <span>Rubro</span>
                            <span>Stock</span>
                            <span>Precio</span>
                            <span />
                          </div>

                          <div className="pos-results-list">
                            {filteredProducts.map((product) => {
                              const status = getProductStatus(product);

                              return (
                                <motion.article
                                  key={product.id || product.sku}
                                  className={`pos-result-row ${!status.available ? "disabled" : ""}`}
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                >
                                  <strong className="pos-result-sku">
                                    {product.sku || "SIN-SKU"}
                                  </strong>

                                  <div className="pos-result-name">
                                    <span className="pos-result-icon">
                                      {product.categoria === "Servicios" ? (
                                        <WalletCards size={17} />
                                      ) : (
                                        <Boxes size={17} />
                                      )}
                                    </span>
                                    <div>
                                      <strong>{product.nombre || "Producto"}</strong>
                                      <small>{product.categoria || "General"}</small>
                                    </div>
                                  </div>

                                  <span className="pos-result-category">
                                    {product.categoria || "General"}
                                  </span>

                                  <span className={status.className}>
                                    {status.label}
                                  </span>

                                  <strong className="pos-result-price">
                                    {formatMoney(product.precio)}
                                  </strong>

                                  <button
                                    type="button"
                                    className="pos-result-add"
                                    disabled={!status.available}
                                    onClick={() => addToCart(product)}
                                    title={status.available ? "Agregar" : "Sin stock"}
                                  >
                                    <Plus size={16} />
                                  </button>
                                </motion.article>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              </section>

              <aside className="pos-summary-column">
                <section className="pos-card pos-summary-card">
                  <div className="pos-card-heading">
                    <div className="pos-card-title">
                      <span className="pos-card-icon pos-card-icon-cart">
                        <ReceiptText size={18} />
                      </span>
                      <div>
                        <strong>Detalle de venta</strong>
                        <small>{cartCount} conceptos cargados</small>
                      </div>
                    </div>

                    {cart.length > 0 && (
                      <button
                        type="button"
                        className="pos-clear-sale"
                        onClick={clearCart}
                      >
                        <Trash2 size={14} />
                        Vaciar
                      </button>
                    )}
                  </div>

                  <div className="pos-card-body">
                    <div className="pos-cart-items">
                      {cart.length === 0 ? (
                        <div className="pos-cart-empty">
                          <Package size={27} />
                          <strong>Venta vacía</strong>
                          <span>Buscá un producto o ingresá un código para agregarlo.</span>
                        </div>
                      ) : (
                        cart.map((item, index) => (
                          <article key={`${item.sku}-${index}`} className="pos-cart-item">
                            <div className="pos-cart-item-main">
                              <strong>{item.nombre}</strong>
                              <span>
                                {item.sku} · {formatMoney(item.precio)} c/u
                                {item.manual ? " · Manual" : ""}
                              </span>
                            </div>

                            <div className="pos-qty-control">
                              <button type="button" onClick={() => changeQuantity(item, index, -1)}>
                                <Minus size={13} />
                              </button>
                              <strong>{item.cantidad}</strong>
                              <button type="button" onClick={() => changeQuantity(item, index, 1)}>
                                <Plus size={13} />
                              </button>
                            </div>

                            <div className="pos-cart-item-total">
                              <strong>{formatMoney(Number(item.precio) * Number(item.cantidad))}</strong>
                              <button
                                type="button"
                                onClick={() => removeFromCart(index)}
                                title="Quitar"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>

                    <div className="pos-discount-box">
                      <div className="pos-discount-heading">
                        <div>
                          <BadgePercent size={16} />
                          <strong>Promoción / descuento</strong>
                        </div>
                        <span>Una opción por venta</span>
                      </div>

                      <div className="pos-discount-controls">
                        <label className="pos-promotion-field">
                          <span>Promoción activa</span>
                          <select
                            value={selectedPromotionId}
                            onChange={(event) => {
                              setSelectedPromotionId(event.target.value);
                              if (event.target.value) setDiscountPercent("0");
                            }}
                          >
                            <option value="">Sin promoción</option>
                            {promotions.map((promotion) => (
                              <option key={promotion.id} value={promotion.id}>
                                {promotion.nombre} · {promotion.tipo === "Porcentaje (%)"
                                  ? `${promotion.valor}%`
                                  : formatMoney(promotion.valor)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="pos-percent-field">
                          <span className="pos-percent-label">Descuento manual</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={discountPercent}
                            disabled={Boolean(selectedPromotionId)}
                            onChange={(event) => {
                              setSelectedPromotionId("");
                              setDiscountPercent(event.target.value);
                            }}
                            onBlur={() => setDiscountPercent(String(normalizedDiscountPercent))}
                          />
                          <span>%</span>
                        </label>
                      </div>
                    </div>

                    <div className="pos-cart-totals">
                      <div>
                        <span>Subtotal</span>
                        <strong>{formatMoney(totals.subtotal)}</strong>
                      </div>

                      <div className="discount">
                        <span>
                          {selectedPromotion
                            ? `Promo: ${selectedPromotion.nombre}`
                            : `Descuento (${normalizedDiscountPercent}%)`}
                        </span>
                        <strong>- {formatMoney(totals.discount)}</strong>
                      </div>

                      <div>
                        <span>IVA ({totals.taxRate}%)</span>
                        <strong>{formatMoney(totals.tax)}</strong>
                      </div>

                      <div className="total">
                        <span>Total a enviar a Caja</span>
                        <strong>{formatMoney(totals.total)}</strong>
                      </div>
                    </div>

                    <div className="pos-cash-note">
                      <CheckCircle2 size={17} />
                      <div>
                        <strong>El Punto de Venta no cobra</strong>
                        <span>
                          POS arma la operación y genera el pendiente. Caja elige el medio de pago,
                          aplica saldo a favor o financiación y confirma el cobro.
                        </span>
                      </div>
                    </div>

                    <div className="pos-flow">
                      <div>
                        <ShoppingCart size={16} />
                        <strong>POS</strong>
                        <span>Arma la venta</span>
                      </div>
                      <ChevronRight size={16} />
                      <div>
                        <ReceiptText size={16} />
                        <strong>Pendiente</strong>
                        <span>Queda preparado</span>
                      </div>
                      <ChevronRight size={16} />
                      <div>
                        <Send size={16} />
                        <strong>Caja</strong>
                        <span>Realiza el cobro</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="pos-checkout"
                      disabled={!cart.length || sending}
                      onClick={handleCheckout}
                    >
                      <Send size={17} />
                      {sending ? "Enviando a Caja..." : "Enviar a Caja"}
                      {!sending && <ChevronRight size={16} />}
                    </button>
                  </div>
                </section>
              </aside>
            </div>
          </>
        ) : (
          <section className="pos-history-card">
            <div className="pos-history-heading">
              <div>
                <span>Operaciones cobradas</span>
                <h2>Historial de ventas</h2>
                <p>Las operaciones aparecen cuando Caja confirma el cobro.</p>
              </div>

              <button
                type="button"
                className="pos-history-back"
                onClick={() => setActiveTab("sale")}
              >
                <ArrowLeft size={15} />
                Volver al POS
              </button>
            </div>

            {sales.length === 0 ? (
              <div className="pos-state history">
                <ReceiptText size={26} />
                <strong>Sin ventas registradas</strong>
                <span>Las operaciones aparecerán cuando Caja confirme el cobro.</span>
              </div>
            ) : (
              <div className="pos-history-table-wrap">
                <table className="pos-history-table">
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Cliente</th>
                      <th>Artículos</th>
                      <th>Pago</th>
                      <th>Total</th>
                      <th>Fecha / hora</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sales.map((sale) => (
                      <tr key={sale.id}>
                        <td className="mono">{sale.folio || sale.id}</td>
                        <td>{sale.cliente || "Mostrador"}</td>
                        <td className="pos-history-description">{sale.articulos || "—"}</td>
                        <td>
                          <span className={`pos-payment-badge ${salePaymentClass(sale.pago)}`}>
                            {sale.pago || "—"}
                          </span>
                        </td>
                        <td className="money">{formatMoney(sale.total)}</td>
                        <td>
                          <span className="pos-history-date">
                            {formatDate(sale.fecha)}
                            <small>{sale.hora || ""}</small>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {newClientOpen && (
        <div
          className="pos-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingNewClient) {
              setNewClientOpen(false);
            }
          }}
        >
          <section
            className="pos-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Dar de alta cliente"
          >
            <header className="pos-modal-head">
              <div className="pos-modal-title">
                <span className="pos-modal-icon">
                  <UserPlus size={19} />
                </span>
                <div>
                  <strong>Dar de alta cliente</strong>
                  <span>Alta rápida para continuar la venta sin salir del POS.</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setNewClientOpen(false)}
                disabled={savingNewClient}
                aria-label="Cerrar"
              >
                <X size={17} />
              </button>
            </header>

            <div className="pos-modal-body">
              <div className="pos-modal-note">
                <CheckCircle2 size={17} />
                <span>
                  El cliente se crea con límite de crédito y saldo a favor en cero.
                  Después podés completar su ficha desde Clientes.
                </span>
              </div>

              <div className="pos-modal-grid">
                <label>
                  <span>Nombre *</span>
                  <input
                    value={newClientForm.nombre}
                    onChange={(event) =>
                      updateNewClientField("nombre", event.target.value)
                    }
                    placeholder="Nombre"
                    autoFocus
                    disabled={savingNewClient}
                  />
                </label>

                <label>
                  <span>Apellido</span>
                  <input
                    value={newClientForm.apellido}
                    onChange={(event) =>
                      updateNewClientField("apellido", event.target.value)
                    }
                    placeholder="Apellido"
                    disabled={savingNewClient}
                  />
                </label>

                <label>
                  <span>DNI</span>
                  <input
                    value={newClientForm.dni}
                    onChange={(event) =>
                      updateNewClientField("dni", event.target.value)
                    }
                    placeholder="Documento"
                    inputMode="numeric"
                    disabled={savingNewClient}
                  />
                </label>

                <label>
                  <span>CUIT</span>
                  <input
                    value={newClientForm.cuit}
                    onChange={(event) =>
                      updateNewClientField("cuit", event.target.value)
                    }
                    placeholder="CUIT"
                    inputMode="numeric"
                    disabled={savingNewClient}
                  />
                </label>

                <label>
                  <span>Teléfono</span>
                  <input
                    value={newClientForm.tel}
                    onChange={(event) =>
                      updateNewClientField("tel", event.target.value)
                    }
                    placeholder="+54 9 ..."
                    disabled={savingNewClient}
                  />
                </label>

                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    value={newClientForm.email}
                    onChange={(event) =>
                      updateNewClientField("email", event.target.value)
                    }
                    placeholder="cliente@email.com"
                    disabled={savingNewClient}
                  />
                </label>
              </div>
            </div>

            <footer className="pos-modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setNewClientOpen(false)}
                disabled={savingNewClient}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="primary"
                onClick={handleCreateClient}
                disabled={savingNewClient}
              >
                <UserPlus size={15} />
                {savingNewClient ? "Creando..." : "Crear y seleccionar"}
              </button>
            </footer>
          </section>
        </div>
      )}

      {manualItemOpen && (
        <div
          className="pos-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setManualItemOpen(false);
            }
          }}
        >
          <section
            className="pos-modal pos-manual-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Agregar concepto manual"
          >
            <header className="pos-modal-head">
              <div className="pos-modal-title">
                <span className="pos-modal-icon manual">
                  <ReceiptText size={19} />
                </span>
                <div>
                  <strong>Agregar concepto manual</strong>
                  <span>Para ventas o servicios que no están cargados en Productos.</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setManualItemOpen(false)}
                aria-label="Cerrar"
              >
                <X size={17} />
              </button>
            </header>

            <div className="pos-modal-body">
              <div className="pos-modal-note manual">
                <Package size={17} />
                <span>
                  Un concepto manual no modifica stock. El código es opcional y
                  SERVIX genera uno interno si lo dejás vacío.
                </span>
              </div>

              <div className="pos-modal-grid">
                <label className="wide">
                  <span>Descripción *</span>
                  <input
                    value={manualItemForm.nombre}
                    onChange={(event) =>
                      updateManualItemField("nombre", event.target.value)
                    }
                    placeholder="Ej.: Instalación y configuración de software"
                    autoFocus
                  />
                </label>

                <label>
                  <span>Código / referencia</span>
                  <input
                    value={manualItemForm.codigo}
                    onChange={(event) =>
                      updateManualItemField("codigo", event.target.value)
                    }
                    placeholder="Opcional"
                  />
                </label>

                <label>
                  <span>Cantidad *</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={manualItemForm.cantidad}
                    onChange={(event) =>
                      updateManualItemField("cantidad", event.target.value)
                    }
                  />
                </label>

                <label className="wide">
                  <span>Precio unitario *</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="decimal"
                    value={manualItemForm.precio}
                    onChange={(event) =>
                      updateManualItemField("precio", event.target.value)
                    }
                    placeholder="0"
                  />
                </label>
              </div>
            </div>

            <footer className="pos-modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setManualItemOpen(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="primary"
                onClick={handleAddManualItem}
              >
                <Plus size={15} />
                Agregar a la venta
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
