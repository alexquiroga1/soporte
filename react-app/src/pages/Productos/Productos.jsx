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
  AlertTriangle,
  ArrowLeft,
  BadgePercent,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Package,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import {
  PRODUCT_CATEGORIES,
  PROMOTION_TYPES,
  createProduct,
  createPromotion,
  deleteProduct,
  subscribeToProducts,
  subscribeToPromotions,
  togglePromotion,
  updateProduct,
} from "../../services/productos.service.js";

import {
  notify,
} from "../../services/notifications.js";

import "./Productos.css";

const EMPTY_PRODUCT = {
  nombre: "",
  sku: "",
  categoria: "Componentes",
  precio: "",
  stock: "",
  proveedor: "",
};

const EMPTY_PROMOTION = {
  nombre: "",
  tipo: "Porcentaje (%)",
  valor: "",
  aplicaA: "Todos",
  vence: "",
};

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatCompactMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    notation: "compact",
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 1,
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

function getProductStatus(product) {
  if (product?.categoria === "Servicios") {
    return {
      label: "Servicio",
      className: "products-status-service",
    };
  }

  const stock = Number(product?.stock || 0);
  const stockMax = Math.max(1, Number(product?.stockMax || 0));

  if (stock <= 0) {
    return {
      label: "Agotado",
      className: "products-status-out",
    };
  }

  if (stock / stockMax < 0.25) {
    return {
      label: "Stock bajo",
      className: "products-status-low",
    };
  }

  return {
    label: "Disponible",
    className: "products-status-ok",
  };
}

function getPromotionStatus(promotion) {
  const today = new Date().toISOString().split("T")[0];
  const expired = Boolean(promotion?.vence && promotion.vence < today);

  if (!promotion?.activa) {
    return {
      label: "Inactiva",
      className: "products-promo-inactive",
    };
  }

  if (expired) {
    return {
      label: "Vencida",
      className: "products-promo-expired",
    };
  }

  return {
    label: "Activa",
    className: "products-promo-active",
  };
}

function getErrorMessage(error) {
  const messages = {
    PRODUCT_NAME_REQUIRED: "Ingresá el nombre del producto o servicio.",
    PRODUCT_CATEGORY_INVALID: "La categoría seleccionada no es válida.",
    PRODUCT_SKU_EXISTS: "Ya existe un producto con ese SKU.",
    PRODUCT_SKU_REQUIRED: "No encontramos el SKU del producto.",
    PRODUCT_NOT_FOUND: "El producto ya no existe en Firestore.",
    PROMOTION_NAME_REQUIRED: "Ingresá un nombre para la promoción.",
    PROMOTION_TYPE_INVALID: "El tipo de promoción no es válido.",
    PROMOTION_VALUE_INVALID: "Ingresá un descuento mayor a cero.",
    PROMOTION_PERCENT_INVALID: "El porcentaje no puede superar el 100%.",
    PROMOTION_CATEGORY_INVALID: "La categoría de la promoción no es válida.",
    PROMOTION_NOT_FOUND: "La promoción ya no existe.",
  };

  return (
    messages[error?.message] ||
    error?.message ||
    "Ocurrió un error inesperado."
  );
}

export default function Productos() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const author =
    profile?.nombre ||
    profile?.name ||
    user?.email ||
    "Sistema";

  const [products, setProducts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("catalog");
  const [category, setCategory] = useState("Todos");
  const [search, setSearch] = useState("");

  const [productModal, setProductModal] = useState(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [promotionModal, setPromotionModal] = useState(false);
  const [promotionForm, setPromotionForm] = useState(EMPTY_PROMOTION);

  const [savingProduct, setSavingProduct] = useState(false);
  const [savingPromotion, setSavingPromotion] = useState(false);
  const [deletingSku, setDeletingSku] = useState("");
  const [togglingPromoId, setTogglingPromoId] = useState("");

  useEffect(() => {
    let productsReady = false;
    let promotionsReady = false;

    const updateLoading = () => {
      if (productsReady && promotionsReady) {
        setLoading(false);
      }
    };

    const unsubscribeProducts = subscribeToProducts(
      (rows) => {
        setProducts(rows);
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

    const unsubscribePromotions = subscribeToPromotions(
      (rows) => {
        setPromotions(rows);
        promotionsReady = true;
        updateLoading();
      },
      (error) => {
        console.error(error);
        promotionsReady = true;
        updateLoading();
      }
    );

    return () => {
      unsubscribeProducts();
      unsubscribePromotions();
    };
  }, []);

  const metrics = useMemo(() => {
    const physical = products.filter(
      (product) => product.categoria !== "Servicios"
    );

    const inventoryValue = physical.reduce(
      (sum, product) =>
        sum +
        Number(product.precio || 0) *
          Number(product.stock || 0),
      0
    );

    const lowStock = physical.filter((product) => {
      const stock = Number(product.stock || 0);
      const stockMax = Math.max(1, Number(product.stockMax || 0));
      return stock > 0 && stock / stockMax < 0.25;
    }).length;

    const outOfStock = physical.filter(
      (product) => Number(product.stock || 0) <= 0
    ).length;

    return {
      total: products.length,
      inventoryValue,
      lowStock,
      outOfStock,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        category === "Todos" || product.categoria === category;

      const text = [
        product.nombre,
        product.sku,
        product.categoria,
        product.proveedor,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesCategory && (!query || text.includes(query));
    });
  }, [products, category, search]);

  const filteredPromotions = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return promotions;

    return promotions.filter((promotion) =>
      [
        promotion.nombre,
        promotion.id,
        promotion.tipo,
        promotion.aplicaA,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [promotions, search]);

  const openNewProduct = () => {
    setProductForm(EMPTY_PRODUCT);
    setProductModal({ mode: "new", product: null });
  };

  const openEditProduct = (product) => {
    setProductForm({
      nombre: product.nombre || "",
      sku: product.sku || product.id || "",
      categoria: product.categoria || "Componentes",
      precio: product.precio ?? "",
      stock: product.stock ?? "",
      proveedor: product.proveedor === "—" ? "" : product.proveedor || "",
    });

    setProductModal({ mode: "edit", product });
  };

  const closeProductModal = () => {
    if (savingProduct) return;
    setProductModal(null);
    setProductForm(EMPTY_PRODUCT);
  };

  const handleSaveProduct = async () => {
    try {
      setSavingProduct(true);

      if (productModal?.mode === "edit") {
        await updateProduct(productModal.product.sku, {
          ...productForm,
          author,
        });

        notify.success(
          "Producto actualizado",
          `${productForm.nombre} quedó actualizado en el catálogo.`
        );
      } else {
        const created = await createProduct({
          ...productForm,
          author,
        });

        notify.success(
          "Producto agregado",
          `${created.nombre} · ${created.sku}`
        );
      }

      setProductModal(null);
      setProductForm(EMPTY_PRODUCT);
    } catch (error) {
      console.error(error);
      notify.error("No se pudo guardar", getErrorMessage(error));
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product) => {
    const confirmed = window.confirm(
      `¿Eliminar "${product.nombre}" del catálogo?\n\nSKU: ${product.sku}\nEsta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    try {
      setDeletingSku(product.sku);
      await deleteProduct(product.sku);
      notify.success(
        "Producto eliminado",
        `${product.nombre} fue quitado del catálogo.`
      );
    } catch (error) {
      console.error(error);
      notify.error("No se pudo eliminar", getErrorMessage(error));
    } finally {
      setDeletingSku("");
    }
  };

  const openNewPromotion = () => {
    setPromotionForm(EMPTY_PROMOTION);
    setPromotionModal(true);
  };

  const closePromotionModal = () => {
    if (savingPromotion) return;
    setPromotionModal(false);
    setPromotionForm(EMPTY_PROMOTION);
  };

  const handleCreatePromotion = async () => {
    try {
      setSavingPromotion(true);

      const created = await createPromotion({
        ...promotionForm,
        author,
      });

      notify.success(
        "Promoción creada",
        `${created.nombre} quedó disponible para el POS.`
      );

      setPromotionModal(false);
      setPromotionForm(EMPTY_PROMOTION);
    } catch (error) {
      console.error(error);
      notify.error("No se pudo crear", getErrorMessage(error));
    } finally {
      setSavingPromotion(false);
    }
  };

  const handleTogglePromotion = async (promotion) => {
    try {
      setTogglingPromoId(promotion.id);
      const enabled = await togglePromotion(promotion);

      notify.success(
        enabled ? "Promoción activada" : "Promoción desactivada",
        promotion.nombre
      );
    } catch (error) {
      console.error(error);
      notify.error("No se pudo cambiar el estado", getErrorMessage(error));
    } finally {
      setTogglingPromoId("");
    }
  };

  return (
    <main className="products-page">
      <div className="products-shell">
        <header className="products-header">
          <div className="products-header-main">
            <button
              type="button"
              className="products-back"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft size={17} />
              Dashboard
            </button>

            <div>
              <span className="products-kicker">Inventario</span>
              <h1>Catálogo y Stock</h1>
              <p>
                Productos, repuestos, servicios y promociones del sistema.
              </p>
            </div>
          </div>

          <div className="products-header-actions">
            <button
              type="button"
              className="products-secondary-action"
              onClick={openNewPromotion}
            >
              <BadgePercent size={17} />
              Nueva promoción
            </button>

            <button
              type="button"
              className="products-primary-action"
              onClick={openNewProduct}
            >
              <Plus size={17} />
              Nuevo producto
            </button>
          </div>
        </header>

        <section className="products-metrics">
          <article>
            <div className="products-metric-icon copper">
              <Boxes size={18} />
            </div>
            <div>
              <span>SKU en catálogo</span>
              <strong>{metrics.total}</strong>
              <small>Productos y servicios</small>
            </div>
          </article>

          <article>
            <div className="products-metric-icon green">
              <CircleDollarSign size={18} />
            </div>
            <div>
              <span>Valor de inventario</span>
              <strong>{formatCompactMoney(metrics.inventoryValue)}</strong>
              <small>Precio actual × stock</small>
            </div>
          </article>

          <article>
            <div className="products-metric-icon amber">
              <AlertTriangle size={18} />
            </div>
            <div>
              <span>Stock bajo</span>
              <strong>{metrics.lowStock}</strong>
              <small>Menos del 25%</small>
            </div>
          </article>

          <article>
            <div className="products-metric-icon red">
              <Package size={18} />
            </div>
            <div>
              <span>Agotados</span>
              <strong>{metrics.outOfStock}</strong>
              <small>Sin existencias</small>
            </div>
          </article>
        </section>

        <section className="products-workspace">
          <div className="products-toolbar">
            <div className="products-tabs">
              <button
                type="button"
                className={activeTab === "catalog" ? "active" : ""}
                onClick={() => setActiveTab("catalog")}
              >
                <Boxes size={15} />
                Catálogo
                <span>{products.length}</span>
              </button>

              <button
                type="button"
                className={activeTab === "promotions" ? "active" : ""}
                onClick={() => setActiveTab("promotions")}
              >
                <BadgePercent size={15} />
                Promociones
                <span>{promotions.length}</span>
              </button>
            </div>

            <label className="products-search">
              <Search size={16} />
              <input
                value={search}
                placeholder={
                  activeTab === "catalog"
                    ? "Buscar por nombre, SKU, categoría..."
                    : "Buscar promoción..."
                }
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button type="button" onClick={() => setSearch("")}>
                  <X size={14} />
                </button>
              )}
            </label>
          </div>

          {activeTab === "catalog" && (
            <>
              <div className="products-categories">
                {["Todos", ...PRODUCT_CATEGORIES].map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={category === item ? "active" : ""}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="products-state">
                  <div className="products-loader" />
                  <strong>Cargando catálogo...</strong>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="products-state">
                  <Boxes size={30} />
                  <strong>Sin productos para mostrar</strong>
                  <span>Probá otra búsqueda o cargá un nuevo producto.</span>
                </div>
              ) : (
                <div className="products-table-wrap">
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th>Producto / SKU</th>
                        <th>Categoría</th>
                        <th>Precio</th>
                        <th>Stock</th>
                        <th>Estado</th>
                        <th>Proveedor</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product, index) => {
                        const status = getProductStatus(product);
                        const service = product.categoria === "Servicios";

                        return (
                          <motion.tr
                            key={product.id || product.sku}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18, delay: Math.min(index * 0.015, 0.12) }}
                          >
                            <td>
                              <strong>{product.nombre || "Sin nombre"}</strong>
                              <span className="products-sku">
                                {product.sku || product.id}
                              </span>
                            </td>
                            <td>{product.categoria || "—"}</td>
                            <td className="products-money">
                              {formatMoney(product.precio)}
                            </td>
                            <td className="products-stock">
                              {service
                                ? "—"
                                : `${Number(product.stock || 0)} / ${Number(product.stockMax || 0)}`}
                            </td>
                            <td>
                              <span className={`products-status ${status.className}`}>
                                {status.label}
                              </span>
                            </td>
                            <td>{product.proveedor || "—"}</td>
                            <td>
                              <div className="products-row-actions">
                                <button
                                  type="button"
                                  title="Editar"
                                  onClick={() => openEditProduct(product)}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="danger"
                                  title="Eliminar"
                                  disabled={deletingSku === product.sku}
                                  onClick={() => handleDeleteProduct(product)}
                                >
                                  <Trash2 size={15} />
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
            </>
          )}

          {activeTab === "promotions" && (
            <div className="products-promotion-content">
              {loading ? (
                <div className="products-state">
                  <div className="products-loader" />
                  <strong>Cargando promociones...</strong>
                </div>
              ) : filteredPromotions.length === 0 ? (
                <div className="products-state">
                  <BadgePercent size={30} />
                  <strong>No hay promociones configuradas</strong>
                  <span>Creá una promoción para usarla desde el POS.</span>
                </div>
              ) : (
                <div className="products-table-wrap">
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th>Promoción</th>
                        <th>Descuento</th>
                        <th>Aplica a</th>
                        <th>Vence</th>
                        <th>Estado</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPromotions.map((promotion, index) => {
                        const status = getPromotionStatus(promotion);
                        const discount =
                          promotion.tipo === "Porcentaje (%)"
                            ? `${Number(promotion.valor || 0)}%`
                            : formatMoney(promotion.valor);

                        return (
                          <motion.tr
                            key={promotion.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18, delay: Math.min(index * 0.015, 0.12) }}
                          >
                            <td>
                              <strong>{promotion.nombre || "Promoción"}</strong>
                              <span className="products-sku">{promotion.id}</span>
                            </td>
                            <td>
                              <span className="products-discount">−{discount}</span>
                            </td>
                            <td>{promotion.aplicaA || "Todos"}</td>
                            <td>{formatDate(promotion.vence)}</td>
                            <td>
                              <span className={`products-status ${status.className}`}>
                                {status.label}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className={`products-toggle ${promotion.activa ? "active" : ""}`}
                                disabled={togglingPromoId === promotion.id}
                                onClick={() => handleTogglePromotion(promotion)}
                              >
                                {togglingPromoId === promotion.id
                                  ? "Guardando..."
                                  : promotion.activa
                                    ? "Desactivar"
                                    : "Activar"}
                              </button>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {productModal && (
        <div
          className="products-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeProductModal();
            }
          }}
        >
          <motion.div
            className="products-modal"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <div className="products-modal-head">
              <div className="products-modal-icon">
                <Package size={20} />
              </div>
              <div>
                <span>Catálogo</span>
                <h3>
                  {productModal.mode === "edit"
                    ? "Editar producto"
                    : "Nuevo producto"}
                </h3>
              </div>
              <button type="button" onClick={closeProductModal}>
                <X size={18} />
              </button>
            </div>

            <div className="products-form-grid">
              <label className="full">
                <span>Nombre</span>
                <input
                  autoFocus
                  value={productForm.nombre}
                  placeholder="Ej: SSD Kingston 480 GB"
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      nombre: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>SKU</span>
                <input
                  value={productForm.sku}
                  disabled={productModal.mode === "edit"}
                  placeholder="SKU-0001"
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      sku: event.target.value,
                    }))
                  }
                />
                {productModal.mode !== "edit" && (
                  <small>Si lo dejás vacío, se genera automáticamente.</small>
                )}
              </label>

              <label>
                <span>Categoría</span>
                <select
                  value={productForm.categoria}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      categoria: event.target.value,
                    }))
                  }
                >
                  {PRODUCT_CATEGORIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Precio base</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.precio}
                  placeholder="0"
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      precio: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Stock actual</span>
                <input
                  type="number"
                  min="0"
                  disabled={productForm.categoria === "Servicios"}
                  value={productForm.categoria === "Servicios" ? 0 : productForm.stock}
                  placeholder="0"
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      stock: event.target.value,
                    }))
                  }
                />
                {productForm.categoria === "Servicios" && (
                  <small>Los servicios no descuentan stock físico.</small>
                )}
              </label>

              <label className="full">
                <span>Proveedor</span>
                <input
                  value={productForm.proveedor}
                  placeholder="Opcional"
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      proveedor: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="products-modal-foot">
              <button
                type="button"
                className="products-modal-cancel"
                disabled={savingProduct}
                onClick={closeProductModal}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="products-modal-save"
                disabled={savingProduct}
                onClick={handleSaveProduct}
              >
                <CheckCircle2 size={16} />
                {savingProduct ? "Guardando..." : "Guardar producto"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {promotionModal && (
        <div
          className="products-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePromotionModal();
            }
          }}
        >
          <motion.div
            className="products-modal products-promo-modal"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <div className="products-modal-head">
              <div className="products-modal-icon purple">
                <Tag size={20} />
              </div>
              <div>
                <span>POS</span>
                <h3>Nueva promoción</h3>
              </div>
              <button type="button" onClick={closePromotionModal}>
                <X size={18} />
              </button>
            </div>

            <div className="products-form-grid">
              <label className="full">
                <span>Nombre / etiqueta</span>
                <input
                  autoFocus
                  value={promotionForm.nombre}
                  placeholder="Ej: Promo accesorios -10%"
                  onChange={(event) =>
                    setPromotionForm((current) => ({
                      ...current,
                      nombre: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Tipo</span>
                <select
                  value={promotionForm.tipo}
                  onChange={(event) =>
                    setPromotionForm((current) => ({
                      ...current,
                      tipo: event.target.value,
                    }))
                  }
                >
                  {PROMOTION_TYPES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Valor</span>
                <input
                  type="number"
                  min="0"
                  max={promotionForm.tipo === "Porcentaje (%)" ? "100" : undefined}
                  step="0.01"
                  value={promotionForm.valor}
                  placeholder={promotionForm.tipo === "Porcentaje (%)" ? "10" : "5000"}
                  onChange={(event) =>
                    setPromotionForm((current) => ({
                      ...current,
                      valor: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Aplica a</span>
                <select
                  value={promotionForm.aplicaA}
                  onChange={(event) =>
                    setPromotionForm((current) => ({
                      ...current,
                      aplicaA: event.target.value,
                    }))
                  }
                >
                  <option>Todos</option>
                  {PRODUCT_CATEGORIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Válida hasta</span>
                <input
                  type="date"
                  value={promotionForm.vence}
                  onChange={(event) =>
                    setPromotionForm((current) => ({
                      ...current,
                      vence: event.target.value,
                    }))
                  }
                />
                <small>Vacío = 30 días desde hoy.</small>
              </label>
            </div>

            <div className="products-modal-foot">
              <button
                type="button"
                className="products-modal-cancel"
                disabled={savingPromotion}
                onClick={closePromotionModal}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="products-modal-save"
                disabled={savingPromotion}
                onClick={handleCreatePromotion}
              >
                <BadgePercent size={16} />
                {savingPromotion ? "Guardando..." : "Crear promoción"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
