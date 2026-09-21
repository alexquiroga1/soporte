import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  Barcode,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  History,
  Eye,
  Info,
  Package,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Truck,
  X,
  XCircle,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext.jsx";
import {
  PRODUCT_CATEGORIES,
  adjustStock,
  createProduct,
  registerStockEntry,
  subscribeToProducts,
  subscribeToStockMovements,
  updateProduct,
} from "../../services/productos.service.js";

import "./Productos.css";
import "./ProductosTicketsTheme.css";
import technicianCharacter from "../Tickets/assets/technician-character.png";

const EMPTY_PRODUCT = {
  tipo: "Producto",
  nombre: "",
  sku: "",
  categoria: "Componentes",
  costo: "",
  precio: "",
  stock: "",
  stockMin: "",
  proveedor: "",
  ubicacion: "",
  codigoBarras: "",
};

const EMPTY_ENTRY = {
  cantidad: "",
  costoUnitario: "",
  proveedor: "",
  referencia: "",
  observacion: "",
};

const EMPTY_ADJUSTMENT = {
  conteoFisico: "",
  motivo: "Conteo físico",
  observacion: "",
};

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(number(value));
}

function formatCompactMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    notation: "compact",
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 1,
  }).format(number(value));
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isService(product) {
  return (
    String(product?.tipo || "").toLowerCase() === "servicio" ||
    String(product?.categoria || "").toLowerCase() === "servicios"
  );
}

function getReserved(product) {
  return Math.max(0, number(product?.stockReservado));
}

function getPhysical(product) {
  return Math.max(0, number(product?.stock));
}

function getAvailable(product) {
  return Math.max(0, getPhysical(product) - getReserved(product));
}

function getMinimum(product) {
  const explicit = Math.max(0, number(product?.stockMin));
  if (explicit > 0) return explicit;

  const legacyMax = Math.max(0, number(product?.stockMax));
  return legacyMax > 0 ? Math.max(1, Math.ceil(legacyMax * 0.25)) : 0;
}

function getProductStatus(product) {
  if (isService(product)) {
    return { label: "Servicio", className: "service" };
  }

  const available = getAvailable(product);
  const minimum = getMinimum(product);

  if (available <= 0) {
    return { label: "Sin stock", className: "out" };
  }

  if (minimum > 0 && available <= minimum) {
    return { label: "Stock bajo", className: "low" };
  }

  return { label: "Disponible", className: "ok" };
}

function getMargin(product) {
  const cost = number(product?.costo);
  const price = number(product?.precio);

  if (cost <= 0 || price <= 0) return null;
  return ((price - cost) / cost) * 100;
}

function getErrorMessage(error) {
  const messages = {
    PRODUCT_NAME_REQUIRED: "Ingresá el nombre del producto o servicio.",
    PRODUCT_CATEGORY_INVALID: "La categoría seleccionada no es válida.",
    PRODUCT_SKU_EXISTS: "Ya existe un artículo con ese SKU.",
    PRODUCT_SKU_REQUIRED: "Seleccioná un producto válido.",
    PRODUCT_NOT_FOUND: "El producto ya no existe en Firestore.",
    PRODUCT_PRICE_REQUIRED: "Ingresá un precio de venta mayor a cero.",
    PRODUCT_HAS_STOCK:
      "No podés convertirlo en servicio mientras tenga stock o reservas.",
    STOCK_QUANTITY_INVALID: "Ingresá una cantidad mayor a cero.",
    STOCK_REASON_REQUIRED: "Seleccioná un motivo para el ajuste.",
    STOCK_BELOW_RESERVED:
      "El conteo físico no puede quedar por debajo del stock reservado.",
    STOCK_NO_CHANGE: "El conteo coincide con el stock registrado.",
    SERVICE_HAS_NO_STOCK: "Los servicios no administran stock físico.",
  };

  return messages[error?.message] || error?.message || "Ocurrió un error inesperado.";
}

function movementTone(type) {
  const value = String(type || "").toLowerCase();
  if (value.includes("ingreso") || value.includes("devolución")) return "in";
  if (value.includes("salida")) return "out";
  if (value.includes("reserva") || value.includes("liberación")) return "reserve";
  return "adjust";
}

function movementQuantity(value) {
  const qty = number(value);
  if (qty > 0) return `+${qty}`;
  return String(qty);
}

function AuroraToast({ toast, onClose }) {
  const timerRef = useRef(null);
  const startedRef = useRef(0);
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
      className={`products-aurora-toast ${toast.type}`}
      initial={{ opacity: 0, y: 18, x: 12, scale: 0.94, rotate: 0.8 }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, x: 26, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      <div className="products-aurora-toast-icon">
        <Icon size={21} />
      </div>

      <div className="products-aurora-toast-copy">
        <strong>{toast.title}</strong>
        <span>{toast.description}</span>
      </div>

      <button
        type="button"
        className="products-aurora-toast-close"
        onClick={onClose}
        aria-label="Cerrar notificación"
      >
        <X size={14} />
      </button>

      <div className="products-aurora-toast-progress">
        <span />
      </div>
    </motion.div>
  );
}

export default function Productos() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const author = profile?.nombre || profile?.name || user?.email || "Sistema";

  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [activeTab, setActiveTab] = useState("catalog");

  const [selectedProductId, setSelectedProductId] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");

  const [movementSearch, setMovementSearch] = useState("");
  const [movementType, setMovementType] = useState("");
  const [movementOrigin, setMovementOrigin] = useState("");

  const [productModal, setProductModal] = useState(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [savingProduct, setSavingProduct] = useState(false);

  const [entryModal, setEntryModal] = useState(false);
  const [entrySearch, setEntrySearch] = useState("");
  const [entryProduct, setEntryProduct] = useState(null);
  const [entryForm, setEntryForm] = useState(EMPTY_ENTRY);
  const [savingEntry, setSavingEntry] = useState(false);

  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState(null);
  const [adjustForm, setAdjustForm] = useState(EMPTY_ADJUSTMENT);
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  const [labelProduct, setLabelProduct] = useState(null);
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((type, title, description) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((current) => [...current, { id, type, title, description }].slice(-4));
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const unsubscribeProducts = subscribeToProducts(
      (rows) => {
        setProducts(rows);
        setLoadingProducts(false);
      },
      (error) => {
        console.error(error);
        setLoadingProducts(false);
        pushToast(
          "error",
          "No pudimos cargar el catálogo",
          "Revisá la conexión o los permisos de Firestore."
        );
      }
    );

    const unsubscribeMovements = subscribeToStockMovements(
      (rows) => {
        setMovements(rows);
        setLoadingMovements(false);
      },
      (error) => {
        console.error(error);
        setLoadingMovements(false);
        pushToast(
          "warning",
          "Historial no disponible",
          "El catálogo funciona, pero no pudimos leer los movimientos de stock."
        );
      }
    );

    return () => {
      unsubscribeProducts();
      unsubscribeMovements();
    };
  }, [pushToast]);

  const physicalProducts = useMemo(
    () => products.filter((product) => !isService(product) && product.activo !== false),
    [products]
  );

  const metrics = useMemo(() => {
    const inventoryValue = physicalProducts.reduce(
      (sum, product) => sum + number(product.costo) * getPhysical(product),
      0
    );

    const lowStock = physicalProducts.filter((product) => {
      const available = getAvailable(product);
      const minimum = getMinimum(product);
      return available > 0 && minimum > 0 && available <= minimum;
    }).length;

    const outOfStock = physicalProducts.filter(
      (product) => getAvailable(product) <= 0
    ).length;

    const reserved = physicalProducts.reduce(
      (sum, product) => sum + getReserved(product),
      0
    );

    return {
      total: products.filter((product) => product.activo !== false).length,
      physical: physicalProducts.length,
      services: products.filter(isService).length,
      inventoryValue,
      lowStock,
      outOfStock,
      reserved,
    };
  }, [products, physicalProducts]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const type = isService(product) ? "Servicio" : "Producto";
      const status = getProductStatus(product).label;
      const text = [
        product.nombre,
        product.sku,
        product.id,
        product.codigoBarras,
        product.categoria,
        product.proveedor,
        product.ubicacion,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!query || text.includes(query)) &&
        (!typeFilter || type === typeFilter) &&
        (!categoryFilter || product.categoria === categoryFilter) &&
        (!stockFilter || status === stockFilter)
      );
    });
  }, [products, search, typeFilter, categoryFilter, stockFilter]);

  const replenishment = useMemo(
    () =>
      physicalProducts
        .map((product) => {
          const available = getAvailable(product);
          const minimum = getMinimum(product);
          const suggested = Math.max(0, minimum * 2 - available);
          return { product, available, minimum, suggested };
        })
        .filter((item) => item.minimum > 0 && item.available <= item.minimum)
        .sort((a, b) => a.available - b.available),
    [physicalProducts]
  );

  const filteredMovements = useMemo(() => {
    const query = movementSearch.trim().toLowerCase();

    return movements.filter((movement) => {
      const text = [
        movement.id,
        movement.sku,
        movement.producto,
        movement.referencia,
        movement.usuario,
        movement.origen,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!query || text.includes(query)) &&
        (!movementType || movement.tipo === movementType) &&
        (!movementOrigin || movement.origen === movementOrigin)
      );
    });
  }, [movements, movementSearch, movementType, movementOrigin]);

  const movementTypes = useMemo(
    () => [...new Set(movements.map((item) => item.tipo).filter(Boolean))].sort(),
    [movements]
  );

  const movementOrigins = useMemo(
    () => [...new Set(movements.map((item) => item.origen).filter(Boolean))].sort(),
    [movements]
  );

  const entrySuggestions = useMemo(() => {
    const query = entrySearch.trim().toLowerCase();
    if (!query || entryProduct) return [];

    return physicalProducts
      .filter((product) =>
        [product.nombre, product.sku, product.codigoBarras]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 8);
  }, [entrySearch, entryProduct, physicalProducts]);

  function openNewProduct() {
    setProductForm(EMPTY_PRODUCT);
    setProductModal({ mode: "new", product: null });
  }

  function openEditProduct(product) {
    setProductForm({
      tipo: isService(product) ? "Servicio" : "Producto",
      nombre: product.nombre || "",
      sku: product.sku || product.id || "",
      categoria: product.categoria || "Componentes",
      costo: product.costo ?? "",
      precio: product.precio ?? "",
      stock: product.stock ?? "",
      stockMin: product.stockMin ?? getMinimum(product),
      proveedor: product.proveedor === "—" ? "" : product.proveedor || "",
      ubicacion: product.ubicacion || "",
      codigoBarras: product.codigoBarras || "",
    });
    setProductModal({ mode: "edit", product });
  }

  function closeProductModal() {
    if (savingProduct) return;
    setProductModal(null);
    setProductForm(EMPTY_PRODUCT);
  }

  async function handleSaveProduct() {
    if (savingProduct) return;

    try {
      setSavingProduct(true);

      const payload = {
        ...productForm,
        categoria: productForm.tipo === "Servicio" ? "Servicios" : productForm.categoria,
        author,
      };

      if (productModal?.mode === "edit") {
        await updateProduct(productModal.product.sku || productModal.product.id, payload);
        pushToast(
          "success",
          "Artículo actualizado",
          `${productForm.nombre} quedó actualizado en el catálogo.`
        );
      } else {
        const created = await createProduct(payload);
        pushToast(
          "success",
          "Artículo creado",
          `${created.nombre} · ${created.sku}`
        );
      }

      setProductModal(null);
      setProductForm(EMPTY_PRODUCT);
    } catch (error) {
      console.error(error);
      pushToast("error", "No se pudo guardar", getErrorMessage(error));
    } finally {
      setSavingProduct(false);
    }
  }

  function openStockEntry(product = null) {
    setEntryProduct(product && !isService(product) ? product : null);
    setEntrySearch(product ? `${product.nombre} · ${product.sku || product.id}` : "");
    setEntryForm({
      ...EMPTY_ENTRY,
      costoUnitario: product?.costo ?? "",
      proveedor: product?.proveedor === "—" ? "" : product?.proveedor || "",
    });
    setEntryModal(true);
  }

  function selectEntryProduct(product) {
    setEntryProduct(product);
    setEntrySearch(`${product.nombre} · ${product.sku || product.id}`);
    setEntryForm((current) => ({
      ...current,
      costoUnitario: product.costo ?? "",
      proveedor: product.proveedor === "—" ? "" : product.proveedor || "",
    }));
  }

  function closeEntryModal() {
    if (savingEntry) return;
    setEntryModal(false);
    setEntryProduct(null);
    setEntrySearch("");
    setEntryForm(EMPTY_ENTRY);
  }

  async function handleStockEntry() {
    if (!entryProduct || savingEntry) {
      if (!entryProduct) {
        pushToast("warning", "Seleccioná un producto", "Buscá por nombre o SKU antes de registrar el ingreso.");
      }
      return;
    }

    try {
      setSavingEntry(true);
      const result = await registerStockEntry({
        sku: entryProduct.sku || entryProduct.id,
        ...entryForm,
        author,
      });

      pushToast(
        "success",
        "Ingreso registrado",
        `${entryProduct.nombre}: ${result.stockBefore} → ${result.stockAfter} unidades.`
      );
      closeEntryModalAfterSave();
    } catch (error) {
      console.error(error);
      pushToast("error", "No se pudo registrar el ingreso", getErrorMessage(error));
    } finally {
      setSavingEntry(false);
    }
  }

  function closeEntryModalAfterSave() {
    setEntryModal(false);
    setEntryProduct(null);
    setEntrySearch("");
    setEntryForm(EMPTY_ENTRY);
  }

  function openAdjustment(product) {
    if (!product || isService(product)) return;
    setAdjustProduct(product);
    setAdjustForm({
      ...EMPTY_ADJUSTMENT,
      conteoFisico: String(getPhysical(product)),
    });
    setAdjustModal(true);
  }

  function closeAdjustment() {
    if (savingAdjustment) return;
    setAdjustModal(false);
    setAdjustProduct(null);
    setAdjustForm(EMPTY_ADJUSTMENT);
  }

  async function handleAdjustment() {
    if (!adjustProduct || savingAdjustment) return;

    try {
      setSavingAdjustment(true);
      const result = await adjustStock({
        sku: adjustProduct.sku || adjustProduct.id,
        ...adjustForm,
        author,
      });

      pushToast(
        "success",
        "Ajuste registrado",
        `${adjustProduct.nombre}: ${result.stockBefore} → ${result.stockAfter}. Se creó ${result.movementId}.`
      );
      setAdjustModal(false);
      setAdjustProduct(null);
      setAdjustForm(EMPTY_ADJUSTMENT);
    } catch (error) {
      console.error(error);
      pushToast("error", "No se pudo ajustar el stock", getErrorMessage(error));
    } finally {
      setSavingAdjustment(false);
    }
  }

  function openLabel(product) {
    setLabelProduct(product);
  }

  async function handleReplenishmentList() {
    if (replenishment.length === 0) {
      pushToast("info", "Sin reposición pendiente", "No hay artículos por debajo del stock mínimo.");
      return;
    }

    const text = [
      "SERVIX · LISTA DE REPOSICIÓN",
      new Date().toLocaleDateString("es-AR"),
      "",
      ...replenishment.map(
        ({ product, available, minimum, suggested }) =>
          `${product.sku || product.id} · ${product.nombre} · disponible ${available} · mínimo ${minimum} · sugerido ${suggested}`
      ),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      pushToast(
        "info",
        "Lista de reposición copiada",
        `${replenishment.length} artículos quedaron listos para consultar o enviar al proveedor.`
      );
    } catch (error) {
      console.error(error);
      window.prompt("Copiá la lista de reposición:", text);
    }
  }

  const activeProductCategories = useMemo(
    () => [...new Set([...PRODUCT_CATEGORIES, ...products.map((product) => product.categoria).filter(Boolean)])],
    [products]
  );

  const selectedProduct = filteredProducts.find((product) => (product.id || product.sku) === selectedProductId) || filteredProducts[0] || null;

  return (
    <main className="products-page">
      <div className="products-shell">
        <header className="products-hero">
          <button type="button" className="products-back" onClick={() => navigate("/dashboard")}><ArrowLeft size={17} /> Volver al Menú</button>
          <div className="products-hero-copy">
            <div className="products-brand-icon"><Boxes size={34} /></div>
            <div><h1>Catálogo y Stock</h1><p>Gestioná productos, servicios, existencias y movimientos.</p></div>
          </div>
          <div className="products-hero-art" aria-hidden="true">
            <div className="products-hero-note">Cada producto en su lugar.<strong>Tu inventario, bajo control.</strong></div>
            <img src={technicianCharacter} alt="" />
            <span className="products-hero-float"><Package size={30} /></span>
          </div>
        </header>

        <section className="products-metrics">
          <MetricCard
            label="Artículos activos"
            value={metrics.total}
            detail={`${metrics.physical} productos · ${metrics.services} servicios`}
            icon={<Boxes size={18} />}
            tone="blue"
          />
          <MetricCard
            label="Valor de inventario"
            value={formatCompactMoney(metrics.inventoryValue)}
            detail="Valorizado al costo cargado"
            icon={<CircleDollarSign size={18} />}
            tone="mint"
          />
          <MetricCard
            label="Stock bajo"
            value={metrics.lowStock}
            detail="En o debajo del mínimo"
            icon={<AlertTriangle size={18} />}
            tone="amber"
          />
          <MetricCard
            label="Sin stock disponible"
            value={metrics.outOfStock}
            detail="Requieren reposición"
            icon={<Package size={18} />}
            tone="danger"
          />
          <MetricCard
            label="Stock reservado"
            value={`${metrics.reserved} un.`}
            detail="No disponible para venta libre"
            icon={<ClipboardList size={18} />}
            tone="violet"
          />
        </section>

        <section className="products-workspace">
          <div className="products-workspace-head">
            <div className="products-tabs">
              <TabButton
                active={activeTab === "catalog"}
                icon={<Boxes size={15} />}
                label="Catálogo"
                onClick={() => setActiveTab("catalog")}
              />
              <TabButton
                active={activeTab === "stock"}
                icon={<Package size={15} />}
                label="Stock"
                onClick={() => setActiveTab("stock")}
              />
              <TabButton
                active={activeTab === "movements"}
                icon={<History size={15} />}
                label="Movimientos"
                onClick={() => setActiveTab("movements")}
              />
            </div>
            <div className="products-head-actions">
              <button type="button" className="secondary" onClick={() => openStockEntry()}><Truck size={17} /> Ingreso de stock</button>
              <button type="button" className="primary" onClick={openNewProduct}><Plus size={17} /> Nuevo producto / servicio</button>
            </div>
          </div>

          {activeTab === "catalog" && (
            <div className="products-panel">
              <div className="products-toolbar">
                <label className="products-search">
                  <Search size={17} />
                  <input
                    type="search"
                    aria-label="Buscar productos"
                    value={search}
                    placeholder="Buscar por nombre, SKU, código, proveedor..."
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda">
                      <X size={14} />
                    </button>
                  )}
                </label>

                <select aria-label="Tipo de artículo" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                  <option value="">Producto y servicio</option>
                  <option value="Producto">Producto</option>
                  <option value="Servicio">Servicio</option>
                </select>

                <select aria-label="Categoría" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="">Todas las categorías</option>
                  {activeProductCategories.map((categoryName) => (
                    <option key={categoryName} value={categoryName}>{categoryName}</option>
                  ))}
                </select>

                <select aria-label="Disponibilidad" value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
                  <option value="">Todo el stock</option>
                  <option value="Disponible">Disponible</option>
                  <option value="Stock bajo">Stock bajo</option>
                  <option value="Sin stock">Sin stock</option>
                  <option value="Servicio">Servicio</option>
                </select>
              </div>

              {loadingProducts ? (
                <LoadingState label="Cargando catálogo..." />
              ) : filteredProducts.length === 0 ? (
                <EmptyState
                  icon={<Boxes size={28} />}
                  title="Sin artículos para mostrar"
                  detail="Probá otros filtros o cargá un nuevo producto o servicio."
                />
              ) : (
                <div className="products-table-wrap">
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Producto / servicio</th>
                        <th>Tipo</th>
                        <th>Costo</th>
                        <th>Precio</th>
                        <th>Margen</th>
                        <th>Stock</th>
                        <th>Reservado</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product, index) => {
                        const service = isService(product);
                        const status = getProductStatus(product);
                        const margin = getMargin(product);

                        return (
                          <motion.tr
                            key={product.id || product.sku}
                            className={selectedProduct === product ? "selected" : ""}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18, delay: Math.min(index * 0.012, 0.12) }}
                          >
                            <td>
                              <strong className="products-sku-main">{product.sku || product.id}</strong>
                              <span className="products-row-muted">
                                {product.codigoBarras || "Sin EAN"}
                              </span>
                            </td>
                            <td>
                              <div className="products-name-cell"><span className={`products-item-icon ${service ? "service" : ""}`}><Package size={20} /></span><strong>{product.nombre || "Sin nombre"}</strong></div>
                              <span className="products-row-muted">
                                {[product.categoria, product.proveedor].filter(Boolean).join(" · ") || "—"}
                              </span>
                            </td>
                            <td>
                              <span className={`products-type ${service ? "service" : "product"}`}>
                                {service ? "Servicio" : "Producto"}
                              </span>
                            </td>
                            <td className="products-money">{number(product.costo) > 0 ? formatMoney(product.costo) : "—"}</td>
                            <td className="products-money">{formatMoney(product.precio)}</td>
                            <td className={margin !== null && margin < 20 ? "products-margin low" : "products-margin"}>
                              {margin === null ? "—" : `${margin.toFixed(1).replace(".", ",")}%`}
                            </td>
                            <td className="products-stock-number">{service ? "—" : getPhysical(product)}</td>
                            <td>{service ? "—" : getReserved(product)}</td>
                            <td>
                              <span className={`products-status ${status.className}`}>{status.label}</span>
                            </td>
                            <td>
                              <div className="products-row-actions">
                                <button type="button" title="Ver resumen" aria-label={`Ver resumen de ${product.nombre}`} onClick={() => setSelectedProductId(product.id || product.sku)}><Eye size={15} /></button>
                                <button type="button" title="Editar ficha" onClick={() => openEditProduct(product)}>
                                  <Pencil size={15} />
                                </button>
                                {!service && (
                                  <button type="button" title="Ajustar stock" onClick={() => openAdjustment(product)}>
                                    <SlidersHorizontal size={15} />
                                  </button>
                                )}
                                <button type="button" title="Etiqueta" onClick={() => openLabel(product)}>
                                  <Barcode size={15} />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {!loadingProducts && selectedProduct && <section className="products-selection" aria-label="Resumen del artículo seleccionado">
                <div className="products-selection-heading"><h2>Resumen del artículo seleccionado</h2><button type="button" onClick={() => openEditProduct(selectedProduct)}>Editar ficha <Pencil size={14} /></button></div>
                <div className="products-selection-grid">
                  <div className="products-selection-identity"><span className="products-item-icon"><Boxes size={30} /></span><div><strong>{selectedProduct.nombre}</strong><small>{selectedProduct.sku || selectedProduct.id}</small><span className={`products-status ${getProductStatus(selectedProduct).className}`}>{getProductStatus(selectedProduct).label}</span></div></div>
                  <article><span className="products-summary-icon blue"><Package size={22} /></span><div><span>Disponible</span><strong>{isService(selectedProduct) ? "Servicio" : getAvailable(selectedProduct) + " unidades"}</strong><small>{isService(selectedProduct) ? "Sin inventario físico" : getReserved(selectedProduct) + " reservadas"}</small></div></article>
                  <article><span className="products-summary-icon mint"><CircleDollarSign size={22} /></span><div><span>Precio de venta</span><strong>{formatMoney(selectedProduct.precio)}</strong><small>Costo: {formatMoney(selectedProduct.costo)}</small></div></article>
                  <article><span className="products-summary-icon violet"><Truck size={22} /></span><div><span>Proveedor</span><strong>{selectedProduct.proveedor || "Sin asignar"}</strong><small>{selectedProduct.ubicacion || "Sin ubicación registrada"}</small></div></article>
                  <article><span className="products-summary-icon amber"><ClipboardList size={22} /></span><div><span>Stock mínimo</span><strong>{isService(selectedProduct) ? "No aplica" : getMinimum(selectedProduct) + " unidades"}</strong><small>{selectedProduct.categoria}</small></div></article>
                </div>
              </section>}
            </div>
          )}

          {activeTab === "stock" && (
            <div className="products-panel products-stock-panel">
              <section>
                <div className="products-section-title">
                  <div className="amber"><AlertTriangle size={18} /></div>
                  <span>
                    <strong>Reposición y alertas</strong>
                    <small>Prioridad basada en stock disponible y mínimo configurado</small>
                  </span>
                </div>

                {replenishment.length === 0 ? (
                  <EmptyState
                    icon={<CheckCircle2 size={28} />}
                    title="Stock saludable"
                    detail="No hay artículos por debajo del mínimo configurado."
                  />
                ) : (
                  <div className="products-alert-list">
                    {replenishment.map(({ product, available, minimum, suggested }) => (
                      <article
                        key={product.id || product.sku}
                        className={`products-stock-alert ${available <= 0 ? "critical" : ""}`}
                      >
                        <div className="products-stock-alert-icon">
                          {available <= 0 ? <XCircle size={18} /> : <AlertTriangle size={18} />}
                        </div>
                        <div className="products-stock-alert-copy">
                          <strong>{product.nombre}</strong>
                          <span>{product.sku || product.id} · mínimo {minimum} un. · reservado {getReserved(product)}</span>
                        </div>
                        <div className="products-stock-alert-number">
                          <span>Disponible</span>
                          <strong>{available}</strong>
                        </div>
                        <div className="products-stock-alert-number">
                          <span>Sugerido</span>
                          <strong>{suggested}</strong>
                        </div>
                        <button type="button" onClick={() => openStockEntry(product)}>
                          <Plus size={15} /> Ingresar
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <aside className="products-stock-summary">
                <h3>Resumen operativo</h3>
                <p>Información útil para decidir reposiciones sin mezclarla con ventas ni facturación.</p>
                <SummaryRow label="Unidades físicas" value={physicalProducts.reduce((sum, product) => sum + getPhysical(product), 0)} />
                <SummaryRow label="Unidades reservadas" value={metrics.reserved} />
                <SummaryRow label="Disponibles para vender" value={physicalProducts.reduce((sum, product) => sum + getAvailable(product), 0)} />
                <SummaryRow label="SKU con alerta" value={replenishment.length} />
                <SummaryRow label="Valor a costo" value={formatMoney(metrics.inventoryValue)} />

                <button type="button" className="products-replenishment" onClick={handleReplenishmentList}>
                  <ClipboardList size={16} />
                  Generar lista de reposición
                </button>
              </aside>
            </div>
          )}

          {activeTab === "movements" && (
            <div className="products-panel">
              <div className="products-toolbar movements">
                <label className="products-search">
                  <Search size={17} />
                  <input
                    type="search"
                    aria-label="Buscar movimientos" value={movementSearch}
                    placeholder="Buscar SKU, producto, referencia, usuario..."
                    onChange={(event) => setMovementSearch(event.target.value)}
                  />
                </label>

                <select aria-label="Tipo de movimiento" value={movementType} onChange={(event) => setMovementType(event.target.value)}>
                  <option value="">Todos los movimientos</option>
                  {movementTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>

                <select aria-label="Origen del movimiento" value={movementOrigin} onChange={(event) => setMovementOrigin(event.target.value)}>
                  <option value="">Todos los orígenes</option>
                  {movementOrigins.map((origin) => <option key={origin} value={origin}>{origin}</option>)}
                </select>

                <button
                  type="button"
                  className="products-clear-filters"
                  disabled={!movementSearch && !movementType && !movementOrigin}
                  onClick={() => {
                    setMovementSearch("");
                    setMovementType("");
                    setMovementOrigin("");
                  }}
                >
                  <RefreshCcw size={15} /> Limpiar
                </button>
              </div>

              {loadingMovements ? (
                <LoadingState label="Cargando movimientos..." />
              ) : filteredMovements.length === 0 ? (
                <EmptyState
                  icon={<History size={28} />}
                  title="Sin movimientos"
                  detail="Los ingresos, ajustes y salidas por venta aparecerán acá."
                />
              ) : (
                <div className="products-table-wrap">
                  <table className="products-table products-movements-table">
                    <thead>
                      <tr>
                        <th>Movimiento</th>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Producto / referencia</th>
                        <th>Cantidad</th>
                        <th>Stock</th>
                        <th>Origen</th>
                        <th>Usuario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMovements.slice(0, 250).map((movement, index) => {
                        const tone = movementTone(movement.tipo);
                        return (
                          <motion.tr
                            key={movement.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.16, delay: Math.min(index * 0.006, 0.1) }}
                          >
                            <td><strong>{movement.id}</strong></td>
                            <td>{formatDateTime(movement.creadoEn)}</td>
                            <td><span className={`products-movement-type ${tone}`}>{movement.tipo || "Ajuste"}</span></td>
                            <td>
                              <strong>{movement.producto || movement.sku || "Producto"}</strong>
                              <span className="products-row-muted">
                                {[movement.sku, movement.referencia].filter(Boolean).join(" · ") || "—"}
                              </span>
                            </td>
                            <td className={`products-quantity ${tone}`}>{movementQuantity(movement.cantidad)}</td>
                            <td>{number(movement.stockAntes)} → {number(movement.stockDespues)}</td>
                            <td>{movement.origen || "Inventario"}</td>
                            <td>{movement.usuario || "Sistema"}</td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="products-audit-note">
                <Info size={16} />
                <span>
                  <strong>Trazabilidad:</strong> los movimientos no se eliminan. Una corrección se registra mediante un ajuste compensatorio con usuario, fecha y motivo.
                </span>
              </div>
            </div>
          )}
        </section>
      </div>

      {productModal && (
        <ModalShell title={productModal.mode === "edit" ? "Editar producto / servicio" : "Nuevo producto / servicio"} onClose={closeProductModal}>
          <div className="products-form-grid">
            <Field label="Tipo *">
              <select
                value={productForm.tipo}
                onChange={(event) => {
                  const tipo = event.target.value;
                  setProductForm((current) => ({
                    ...current,
                    tipo,
                    categoria: tipo === "Servicio" ? "Servicios" : current.categoria === "Servicios" ? "Componentes" : current.categoria,
                  }));
                }}
              >
                <option value="Producto">Producto</option>
                <option value="Servicio">Servicio</option>
              </select>
            </Field>

            <Field label="SKU / código *">
              <input
                value={productForm.sku}
                disabled={productModal.mode === "edit"}
                placeholder="Ej.: SSD-KNV2-500"
                onChange={(event) => setProductForm((current) => ({ ...current, sku: event.target.value }))}
              />
            </Field>

            <Field label="Nombre *" wide>
              <input
                autoFocus
                value={productForm.nombre}
                placeholder="Ej.: SSD Kingston NV2 500 GB"
                onChange={(event) => setProductForm((current) => ({ ...current, nombre: event.target.value }))}
              />
            </Field>

            <Field label="Categoría">
              <select
                value={productForm.tipo === "Servicio" ? "Servicios" : productForm.categoria}
                disabled={productForm.tipo === "Servicio"}
                onChange={(event) => setProductForm((current) => ({ ...current, categoria: event.target.value }))}
              >
                {PRODUCT_CATEGORIES.filter((item) => item !== "Servicios").map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
                {productForm.tipo === "Servicio" && <option value="Servicios">Servicios</option>}
              </select>
            </Field>

            <Field label="Proveedor">
              <input
                value={productForm.proveedor}
                placeholder="Opcional"
                onChange={(event) => setProductForm((current) => ({ ...current, proveedor: event.target.value }))}
              />
            </Field>

            <Field label="Costo">
              <input
                type="number"
                min="0"
                value={productForm.costo}
                onChange={(event) => setProductForm((current) => ({ ...current, costo: event.target.value }))}
              />
            </Field>

            <Field label="Precio de venta *">
              <input
                type="number"
                min="0"
                value={productForm.precio}
                onChange={(event) => setProductForm((current) => ({ ...current, precio: event.target.value }))}
              />
            </Field>

            {productForm.tipo === "Producto" && productModal.mode === "new" && (
              <Field label="Stock inicial">
                <input
                  type="number"
                  min="0"
                  value={productForm.stock}
                  onChange={(event) => setProductForm((current) => ({ ...current, stock: event.target.value }))}
                />
              </Field>
            )}

            {productForm.tipo === "Producto" && productModal.mode === "edit" && (
              <Field label="Stock físico">
                <input value={getPhysical(productModal.product)} disabled />
                <small>Para modificar existencias usá Ingreso o Ajuste de stock.</small>
              </Field>
            )}

            {productForm.tipo === "Producto" && (
              <Field label="Stock mínimo">
                <input
                  type="number"
                  min="0"
                  value={productForm.stockMin}
                  onChange={(event) => setProductForm((current) => ({ ...current, stockMin: event.target.value }))}
                />
              </Field>
            )}

            <Field label="Ubicación física">
              <input
                value={productForm.ubicacion}
                placeholder="Ej.: Estante A-03"
                onChange={(event) => setProductForm((current) => ({ ...current, ubicacion: event.target.value }))}
              />
            </Field>

            <Field label="Código de barras / EAN">
              <input
                value={productForm.codigoBarras}
                placeholder="Opcional"
                onChange={(event) => setProductForm((current) => ({ ...current, codigoBarras: event.target.value }))}
              />
            </Field>
          </div>

          <div className="products-modal-info">
            <Info size={16} />
            <span>
              El margen se calcula automáticamente. Los servicios no manejan stock físico. Las existencias de un producto se corrigen mediante movimientos, no editando el número silenciosamente.
            </span>
          </div>

          <div className="products-modal-actions">
            <button type="button" className="cancel" disabled={savingProduct} onClick={closeProductModal}>Cancelar</button>
            <button type="button" className="save" disabled={savingProduct} onClick={handleSaveProduct}>
              {savingProduct ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </ModalShell>
      )}

      {entryModal && (
        <ModalShell title="Registrar ingreso de stock" onClose={closeEntryModal}>
          <div className="products-entry-search-block">
            <label>Producto *</label>
            <div className={`products-product-search ${entryProduct ? "selected" : ""}`}>
              <Search size={17} />
              <input
                autoFocus={!entryProduct}
                value={entrySearch}
                readOnly={Boolean(entryProduct)}
                placeholder="Escribí nombre, SKU o código de barras..."
                onChange={(event) => setEntrySearch(event.target.value)}
              />
              {entryProduct && (
                <button
                  type="button"
                  onClick={() => {
                    setEntryProduct(null);
                    setEntrySearch("");
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {entrySuggestions.length > 0 && (
              <div className="products-product-suggestions">
                {entrySuggestions.map((product) => (
                  <button key={product.id || product.sku} type="button" onClick={() => selectEntryProduct(product)}>
                    <span>
                      <strong>{product.nombre}</strong>
                      <small>{product.sku || product.id} · {product.proveedor || "Sin proveedor"}</small>
                    </span>
                    <b>{getAvailable(product)} disp.</b>
                  </button>
                ))}
              </div>
            )}
          </div>

          {entryProduct && (
            <div className="products-selected-product">
              <div>
                <span>Stock actual</span>
                <strong>{getPhysical(entryProduct)} un.</strong>
              </div>
              <div>
                <span>Reservado</span>
                <strong>{getReserved(entryProduct)} un.</strong>
              </div>
              <div>
                <span>Disponible</span>
                <strong>{getAvailable(entryProduct)} un.</strong>
              </div>
            </div>
          )}

          <div className="products-form-grid compact">
            <Field label="Cantidad *">
              <input
                type="number"
                min="1"
                value={entryForm.cantidad}
                onChange={(event) => setEntryForm((current) => ({ ...current, cantidad: event.target.value }))}
              />
            </Field>
            <Field label="Costo unitario">
              <input
                type="number"
                min="0"
                value={entryForm.costoUnitario}
                onChange={(event) => setEntryForm((current) => ({ ...current, costoUnitario: event.target.value }))}
              />
            </Field>
            <Field label="Proveedor">
              <input
                value={entryForm.proveedor}
                onChange={(event) => setEntryForm((current) => ({ ...current, proveedor: event.target.value }))}
              />
            </Field>
            <Field label="Referencia / comprobante">
              <input
                value={entryForm.referencia}
                placeholder="Ej.: FC-4872"
                onChange={(event) => setEntryForm((current) => ({ ...current, referencia: event.target.value }))}
              />
            </Field>
            <Field label="Observación" wide>
              <textarea
                value={entryForm.observacion}
                placeholder="Reposición, compra, devolución de proveedor..."
                onChange={(event) => setEntryForm((current) => ({ ...current, observacion: event.target.value }))}
              />
            </Field>
          </div>

          <div className="products-modal-info">
            <Info size={16} />
            <span>Si cambia el costo, se conserva el historial anterior. El ingreso crea un movimiento de stock independiente.</span>
          </div>

          <div className="products-modal-actions">
            <button type="button" className="cancel" disabled={savingEntry} onClick={closeEntryModal}>Cancelar</button>
            <button type="button" className="save" disabled={savingEntry} onClick={handleStockEntry}>
              {savingEntry ? "Registrando..." : "Registrar ingreso"}
            </button>
          </div>
        </ModalShell>
      )}

      {adjustModal && adjustProduct && (
        <ModalShell title="Ajuste de inventario" onClose={closeAdjustment}>
          <div className="products-adjust-summary">
            <div>
              <span>Producto</span>
              <strong>{adjustProduct.nombre}</strong>
              <small>{adjustProduct.sku || adjustProduct.id}</small>
            </div>
            <div>
              <span>Stock registrado</span>
              <strong>{getPhysical(adjustProduct)}</strong>
            </div>
            <div>
              <span>Reservado</span>
              <strong>{getReserved(adjustProduct)}</strong>
            </div>
          </div>

          <div className="products-form-grid compact">
            <Field label="Conteo físico *">
              <input
                autoFocus
                type="number"
                min={getReserved(adjustProduct)}
                value={adjustForm.conteoFisico}
                onChange={(event) => setAdjustForm((current) => ({ ...current, conteoFisico: event.target.value }))}
              />
            </Field>
            <Field label="Motivo *">
              <select
                value={adjustForm.motivo}
                onChange={(event) => setAdjustForm((current) => ({ ...current, motivo: event.target.value }))}
              >
                <option>Conteo físico</option>
                <option>Rotura / pérdida</option>
                <option>Error de carga</option>
                <option>Devolución</option>
              </select>
            </Field>
            <Field label="Observación" wide>
              <textarea
                value={adjustForm.observacion}
                placeholder="Detalle del ajuste..."
                onChange={(event) => setAdjustForm((current) => ({ ...current, observacion: event.target.value }))}
              />
            </Field>
          </div>

          <div className="products-modal-info warning">
            <AlertTriangle size={16} />
            <span>El stock no se reemplaza sin rastro: SERVIX registra la diferencia como movimiento compensatorio con usuario y motivo.</span>
          </div>

          <div className="products-modal-actions">
            <button type="button" className="cancel" disabled={savingAdjustment} onClick={closeAdjustment}>Cancelar</button>
            <button type="button" className="save" disabled={savingAdjustment} onClick={handleAdjustment}>
              {savingAdjustment ? "Ajustando..." : "Confirmar ajuste"}
            </button>
          </div>
        </ModalShell>
      )}

      {labelProduct && (
        <div className="products-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && setLabelProduct(null)}>
          <motion.div className="products-label-modal" initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}>
            <div className="products-modal-head no-print">
              <div>
                <Barcode size={19} />
                <span><strong>Etiqueta de producto</strong><small>Vista previa</small></span>
              </div>
              <button type="button" onClick={() => setLabelProduct(null)}><X size={17} /></button>
            </div>

            <div className="products-label-print">
              <strong>{labelProduct.nombre}</strong>
              <div className="products-fake-barcode" />
              <span>{labelProduct.codigoBarras || labelProduct.sku || labelProduct.id}</span>
              <small>{labelProduct.sku || labelProduct.id}</small>
              <b>{formatMoney(labelProduct.precio)}</b>
            </div>

            <div className="products-modal-actions no-print">
              <button type="button" className="cancel" onClick={() => setLabelProduct(null)}>Cerrar</button>
              <button type="button" className="save" onClick={() => window.print()}>
                <Printer size={15} /> Imprimir etiqueta
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="products-toast-area" aria-live="polite">
        {toasts.map((toast) => (
          <AuroraToast
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </main>
  );
}

function MetricCard({ label, value, detail, icon, tone }) {
  return (
    <article className={`products-metric-card ${tone}`}>
      <div className="products-metric-top">
        <span>{label}</span>
        <div className={`products-metric-icon ${tone}`}>{icon}</div>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function TabButton({ active, icon, label, onClick }) {
  return (
    <button type="button" className={active ? "active" : ""} aria-pressed={active} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="products-summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LoadingState({ label }) {
  return (
    <div className="products-state">
      <div className="products-loader" />
      <strong>{label}</strong>
      <span>Sincronizando con Firebase...</span>
    </div>
  );
}

function EmptyState({ icon, title, detail }) {
  return (
    <div className="products-state">
      {icon}
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function Field({ label, wide = false, children }) {
  return (
    <label className={wide ? "full" : ""}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="products-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <motion.div
        className="products-modal"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        <div className="products-modal-head">
          <div>
            <Package size={19} />
            <span><strong>{title}</strong><small>Catálogo y Stock</small></span>
          </div>
          <button type="button" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="products-modal-body">{children}</div>
      </motion.div>
    </div>
  );
}
