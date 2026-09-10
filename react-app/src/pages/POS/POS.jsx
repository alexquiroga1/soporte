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
  CircleDollarSign,
  Minus,
  Package,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Trash2,
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
  notify,
} from "../../services/notifications.js";

import "./POS.css";

const CART_STORAGE_KEY = "servix_cart_temp_react";

/* =========================================
   HELPERS
========================================= */

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
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
  const service = product?.categoria === "Servicios";
  const stock = Number(product?.stock || 0);
  const stockMax = Math.max(1, Number(product?.stockMax || 0));

  if (service) {
    return {
      label: "Servicio",
      className: "pos-stock-service",
      available: true,
    };
  }

  if (stock <= 0) {
    return {
      label: "Agotado",
      className: "pos-stock-out",
      available: false,
    };
  }

  if (stock / stockMax < 0.25) {
    return {
      label: `Bajo · ${stock}`,
      className: "pos-stock-low",
      available: true,
    };
  }

  return {
    label: `${stock} disp.`,
    className: "pos-stock-ok",
    available: true,
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

function readInitialCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
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
  const [category, setCategory] = useState("Todos");
  const [activeTab, setActiveTab] = useState("sale");

  const [cart, setCart] = useState(readInitialCart);
  const [clientId, setClientId] = useState("");
  const [promotionId, setPromotionId] = useState("");
  const [sending, setSending] = useState(false);

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
      (error) => console.error(error)
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
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  /* =======================================
     CATEGORÍAS
  ======================================= */

  const categories = useMemo(() => {
    const values = products
      .map((product) => product.categoria)
      .filter(Boolean);

    return ["Todos", ...new Set(values)];
  }, [products]);

  /* =======================================
     FILTRO PRODUCTOS
  ======================================= */

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        category === "Todos" || product.categoria === category;

      const text = [
        product.nombre,
        product.sku,
        product.categoria,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesCategory && (!query || text.includes(query));
    });
  }, [products, search, category]);

  /* =======================================
     CLIENTE / PROMO
  ======================================= */

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === clientId) || null,
    [clients, clientId]
  );

  const selectedPromotion = useMemo(
    () => promotions.find((promotion) => promotion.id === promotionId) || null,
    [promotions, promotionId]
  );

  /* =======================================
     TOTALES
  ======================================= */

  const taxRate = Number(business?.impuesto ?? 21) || 0;

  const totals = useMemo(
    () =>
      calculatePosTotals({
        cart,
        promotion: selectedPromotion,
        taxRate,
      }),
    [cart, selectedPromotion, taxRate]
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
      const existing = current.find((item) => item.sku === product.sku);

      if (existing) {
        const nextQuantity = Number(existing.cantidad || 0) + 1;

        if (
          product.categoria !== "Servicios" &&
          nextQuantity > Number(product.stock || 0)
        ) {
          notify.warning(
            "Sin más stock",
            `Disponibles: ${Number(product.stock || 0)}.`
          );
          return current;
        }

        return current.map((item) =>
          item.sku === product.sku
            ? { ...item, cantidad: nextQuantity }
            : item
        );
      }

      return [
        ...current,
        {
          productId: product.id,
          sku: product.sku,
          nombre: product.nombre,
          categoria: product.categoria,
          precio: Number(product.precio || 0),
          cantidad: 1,
        },
      ];
    });
  };

  const changeQuantity = (item, delta) => {
    const product = products.find((row) => row.sku === item.sku);

    setCart((current) => {
      const nextQuantity = Number(item.cantidad || 0) + delta;

      if (nextQuantity <= 0) {
        return current.filter((row) => row.sku !== item.sku);
      }

      if (
        product &&
        product.categoria !== "Servicios" &&
        nextQuantity > Number(product.stock || 0)
      ) {
        notify.warning(
          "Sin más stock",
          `Disponibles: ${Number(product.stock || 0)}.`
        );
        return current;
      }

      return current.map((row) =>
        row.sku === item.sku
          ? { ...row, cantidad: nextQuantity }
          : row
      );
    });
  };

  const removeFromCart = (sku) => {
    setCart((current) => current.filter((item) => item.sku !== sku));
  };

  const clearCart = () => {
    if (!cart.length) return;

    const confirmed = window.confirm("¿Vaciar todo el carrito?");
    if (!confirmed) return;

    setCart([]);
    setPromotionId("");
  };

  /* =======================================
     ENVIAR A CAJA
  ======================================= */

  const handleCheckout = async () => {
    if (!cart.length || sending) return;

    try {
      setSending(true);

      const result = await sendPosSaleToCash({
        cart,
        client: selectedClient,
        promotion: selectedPromotion,
        taxRate,
        author,
      });

      setCart([]);
      setPromotionId("");
      localStorage.removeItem(CART_STORAGE_KEY);

      notify.success(
        "Venta enviada a Caja",
        `${result.folio} quedó pendiente de cobro por ${formatMoney(result.total)}.`
      );

      navigate("/caja");
    } catch (error) {
      console.error(error);

      const messages = {
        POS_CART_EMPTY: "Agregá al menos un producto o servicio.",
        POS_PRODUCT_INVALID: "Hay un artículo inválido en el carrito.",
        POS_TOTAL_INVALID: "El total de la venta no es válido.",
        POS_PRODUCT_NOT_FOUND: `No encontramos ${error?.productName || "un producto"} en Firestore.`,
        POS_STOCK_INSUFFICIENT: `Stock insuficiente para ${error?.productName || "un producto"}. Disponible: ${error?.available ?? 0}.`,
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

  const today = new Date().toISOString().split("T")[0];
  const todaySales = sales.filter((sale) => sale.fecha === today);
  const todayTotal = todaySales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  );

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
          >
            <ArrowLeft size={20} />
          </button>

          <div className="pos-header-icon">
            <ShoppingCart size={21} />
          </div>

          <div>
            <span>Ventas</span>
            <h1>Punto de Venta</h1>
          </div>
        </div>

        <div className="pos-header-status">
          <span />
          <div>
            <strong>POS conectado</strong>
            <small>Catálogo en tiempo real</small>
          </div>
        </div>
      </header>

      <div className="pos-content">
        <motion.section
          className="pos-intro"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <span className="pos-kicker">Operación comercial</span>
            <h2>Venta rápida</h2>
            <p>
              Armá el carrito, aplicá promociones y enviá la operación a Caja.
              El cobro y la factura se procesan allí.
            </p>
          </div>

          <div className="pos-today-card">
            <CircleDollarSign size={18} />
            <div>
              <span>Ventas cobradas hoy</span>
              <strong>{formatMoney(todayTotal)}</strong>
              <small>{todaySales.length} operaciones</small>
            </div>
          </div>
        </motion.section>

        <section className="pos-workspace">
          <div className="pos-tabs">
            <button
              type="button"
              className={activeTab === "sale" ? "active" : ""}
              onClick={() => setActiveTab("sale")}
            >
              <ShoppingCart size={16} />
              Nueva venta
              {cartCount > 0 && <span>{cartCount}</span>}
            </button>

            <button
              type="button"
              className={activeTab === "history" ? "active" : ""}
              onClick={() => setActiveTab("history")}
            >
              <ReceiptText size={16} />
              Historial
              <span>{sales.length}</span>
            </button>
          </div>

          {activeTab === "sale" && (
            <div className="pos-sale-layout">
              <section className="pos-catalog-panel">
                <div className="pos-catalog-toolbar">
                  <div className="pos-search">
                    <Search size={16} />
                    <input
                      type="search"
                      placeholder="Buscar producto, servicio o SKU..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />

                    {search && (
                      <button type="button" onClick={() => setSearch("")}>
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <span className="pos-catalog-count">
                    {filteredProducts.length} resultados
                  </span>
                </div>

                <div className="pos-category-tabs">
                  {categories.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={category === item ? "active" : ""}
                      onClick={() => setCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                {loading ? (
                  <div className="pos-state">
                    <div className="pos-loader" />
                    <strong>Cargando catálogo...</strong>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="pos-state">
                    <Package size={26} />
                    <strong>Sin resultados</strong>
                    <span>Probá con otra búsqueda o categoría.</span>
                  </div>
                ) : (
                  <div className="pos-product-grid">
                    {filteredProducts.map((product) => {
                      const status = getProductStatus(product);

                      return (
                        <motion.article
                          key={product.id || product.sku}
                          className={`pos-product-card ${!status.available ? "disabled" : ""}`}
                          whileHover={status.available ? { y: -2 } : undefined}
                        >
                          <div className="pos-product-top">
                            <span className="pos-product-sku">
                              {product.sku || "SIN-SKU"}
                            </span>

                            <span className={status.className}>
                              {status.label}
                            </span>
                          </div>

                          <div className="pos-product-icon">
                            {product.categoria === "Servicios" ? (
                              <WalletCards size={19} />
                            ) : (
                              <Boxes size={19} />
                            )}
                          </div>

                          <div className="pos-product-info">
                            <span>{product.categoria || "General"}</span>
                            <h3>{product.nombre || "Producto"}</h3>
                          </div>

                          <div className="pos-product-footer">
                            <strong>{formatMoney(product.precio)}</strong>

                            <button
                              type="button"
                              disabled={!status.available}
                              onClick={() => addToCart(product)}
                              title={status.available ? "Agregar" : "Sin stock"}
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </motion.article>
                      );
                    })}
                  </div>
                )}
              </section>

              <aside className="pos-cart-panel">
                <div className="pos-cart-heading">
                  <div>
                    <span>Operación actual</span>
                    <h3>Carrito</h3>
                  </div>

                  <div className="pos-cart-heading-actions">
                    <span>{cartCount} items</span>
                    {cart.length > 0 && (
                      <button type="button" onClick={clearCart} title="Vaciar carrito">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="pos-cart-items">
                  {cart.length === 0 ? (
                    <div className="pos-cart-empty">
                      <ShoppingCart size={26} />
                      <strong>Carrito vacío</strong>
                      <span>Agregá productos o servicios desde el catálogo.</span>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <article key={item.sku} className="pos-cart-item">
                        <div className="pos-cart-item-main">
                          <strong>{item.nombre}</strong>
                          <span>
                            {item.sku} · {formatMoney(item.precio)} c/u
                          </span>
                        </div>

                        <div className="pos-qty-control">
                          <button
                            type="button"
                            onClick={() => changeQuantity(item, -1)}
                          >
                            <Minus size={13} />
                          </button>

                          <strong>{item.cantidad}</strong>

                          <button
                            type="button"
                            onClick={() => changeQuantity(item, 1)}
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        <div className="pos-cart-item-total">
                          <strong>
                            {formatMoney(Number(item.precio) * Number(item.cantidad))}
                          </strong>

                          <button
                            type="button"
                            onClick={() => removeFromCart(item.sku)}
                            title="Quitar"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>

                <div className="pos-cart-config">
                  <label>
                    <span>
                      <UserRound size={14} />
                      Cliente
                    </span>

                    <select
                      value={clientId}
                      onChange={(event) => setClientId(event.target.value)}
                    >
                      <option value="">Mostrador / Consumidor final</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {getClientDisplayName(client)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>
                      <BadgePercent size={14} />
                      Promoción
                    </span>

                    <select
                      value={promotionId}
                      onChange={(event) => setPromotionId(event.target.value)}
                    >
                      <option value="">Sin promoción</option>
                      {promotions.map((promotion) => (
                        <option key={promotion.id} value={promotion.id}>
                          {promotion.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="pos-cart-totals">
                  <div>
                    <span>Subtotal</span>
                    <strong>{formatMoney(totals.subtotal)}</strong>
                  </div>

                  {totals.discount > 0 && (
                    <div className="discount">
                      <span>Descuento</span>
                      <strong>- {formatMoney(totals.discount)}</strong>
                    </div>
                  )}

                  <div>
                    <span>IVA ({totals.taxRate}%)</span>
                    <strong>{formatMoney(totals.tax)}</strong>
                  </div>

                  <div className="total">
                    <span>Total a cobrar</span>
                    <strong>{formatMoney(totals.total)}</strong>
                  </div>
                </div>

                <div className="pos-cash-note">
                  <CheckCircle2 size={16} />
                  <div>
                    <strong>El medio de pago se elige en Caja</strong>
                    <span>
                      Así el POS prepara la venta y Caja concentra el cobro y la factura.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="pos-checkout"
                  disabled={!cart.length || sending}
                  onClick={handleCheckout}
                >
                  <CircleDollarSign size={17} />
                  {sending ? "Enviando a Caja..." : "Enviar a Caja para cobro"}
                  {!sending && <ChevronRight size={16} />}
                </button>
              </aside>
            </div>
          )}

          {activeTab === "history" && (
            <div className="pos-history">
              <div className="pos-history-heading">
                <div>
                  <span>Operaciones cobradas</span>
                  <h3>Historial de ventas</h3>
                </div>

                <strong>{sales.length} registros</strong>
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
                          <td className="pos-history-description">
                            {sale.articulos || "—"}
                          </td>
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
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
