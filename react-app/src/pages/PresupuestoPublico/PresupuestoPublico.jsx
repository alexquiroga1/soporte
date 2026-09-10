import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
} from "react-router-dom";

import {
  motion,
} from "motion/react";

import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleX,
  ClipboardCheck,
  Clock3,
  FileText,
  Laptop,
  ReceiptText,
  ShieldCheck,
  Wrench,
  X,
  XCircle,
} from "lucide-react";

import {
  respondToPublicBudget,
  subscribeToPublicBudget,
} from "../../services/presupuesto-publico.service.js";

import "./PresupuestoPublico.css";

/* =========================================
   HELPERS
========================================= */

function formatMoney(value) {
  return new Intl.NumberFormat(
    "es-AR",
    {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }
  ).format(
    Number(value || 0)
  );
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const text =
    String(value);

  const parts =
    text.split("-");

  if (
    parts.length === 3 &&
    parts[0].length === 4
  ) {
    const [
      year,
      month,
      day,
    ] = parts;

    return `${day}/${month}/${year}`;
  }

  return text;
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return date.toLocaleString(
    "es-AR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function isExpired(
  budget
) {
  if (
    !budget?.fechaVencimiento
  ) {
    return false;
  }

  const expiration =
    new Date(
      `${budget.fechaVencimiento}T23:59:59`
    );

  if (
    Number.isNaN(
      expiration.getTime()
    )
  ) {
    return false;
  }

  return (
    expiration.getTime() <
    Date.now()
  );
}

function getResponseError(
  error
) {
  const map = {
    PUBLIC_TOKEN_INVALID:
      "El enlace de presupuesto no es válido.",

    PUBLIC_BUDGET_NOT_FOUND:
      "No encontramos este presupuesto.",

    PUBLIC_BUDGET_DISABLED:
      "Este enlace ya no se encuentra disponible.",

    PUBLIC_BUDGET_ALREADY_RESPONDED:
      "Este presupuesto ya fue respondido anteriormente.",

    PUBLIC_RESPONSE_INVALID:
      "La respuesta seleccionada no es válida.",

    BUDGET_EXPIRED:
      "El presupuesto está vencido y ya no puede responderse.",
  };

  return (
    map[
      error?.message
    ] ||
    error?.message ||
    "No pudimos registrar la respuesta. Intentá nuevamente."
  );
}

/* =========================================
   COMPONENTE
========================================= */

export default function PresupuestoPublico() {
  const {
    token,
  } =
    useParams();

  const [
    budget,
    setBudget,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    loadError,
    setLoadError,
  ] =
    useState("");

  const [
    decision,
    setDecision,
  ] =
    useState(null);

  const [
    sending,
    setSending,
  ] =
    useState(false);

  const [
    responseError,
    setResponseError,
  ] =
    useState("");

  /* =======================================
     FIRESTORE
  ======================================= */

  useEffect(
    () => {
      setLoading(
        true
      );

      setLoadError(
        ""
      );

      if (
        !token
      ) {
        setLoading(
          false
        );

        setLoadError(
          "El enlace de presupuesto no es válido."
        );

        return undefined;
      }

      const unsubscribe =
        subscribeToPublicBudget(
          token,

          (
            data
          ) => {
            setBudget(
              data
            );

            setLoading(
              false
            );

            if (
              !data
            ) {
              setLoadError(
                "No encontramos este presupuesto o el enlace dejó de estar disponible."
              );
            } else {
              setLoadError(
                ""
              );
            }
          },

          (
            error
          ) => {
            console.error(
              error
            );

            setLoading(
              false
            );

            setLoadError(
              "No pudimos cargar el presupuesto. Verificá el enlace o intentá nuevamente."
            );
          }
        );

      return unsubscribe;
    },
    [
      token,
    ]
  );

  /* =======================================
     ESTADO
  ======================================= */

  const expired =
    useMemo(
      () =>
        isExpired(
          budget
        ),
      [
        budget,
      ]
    );

  const responded =
    Boolean(
      budget?.respuesta
    );

  const disabled =
    budget?.activo ===
    false;

  const canRespond =
    Boolean(
      budget &&
      !expired &&
      !responded &&
      !disabled
    );

  const items =
    useMemo(
      () =>
        Array.isArray(
          budget?.items
        )
          ? budget.items
          : [],
      [
        budget,
      ]
    );

  const discount =
    Number(
      budget?.descuento ||
      0
    );

  /* =======================================
     MODAL
  ======================================= */

  const openDecision =
    (
      type
    ) => {
      if (
        !canRespond ||
        sending
      ) {
        return;
      }

      setDecision(
        type
      );

      setResponseError(
        ""
      );
    };

  const closeDecision =
    () => {
      if (
        sending
      ) {
        return;
      }

      setDecision(
        null
      );

      setResponseError(
        ""
      );
    };

  /* =======================================
     RESPONDER
  ======================================= */

  const confirmDecision =
    async () => {
      if (
        !decision ||
        !token ||
        sending
      ) {
        return;
      }

      try {
        setSending(
          true
        );

        setResponseError(
          ""
        );

        await respondToPublicBudget(
          token,
          decision ===
            "accept"
            ? "Aceptado"
            : "Rechazado"
        );

        setDecision(
          null
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        setResponseError(
          getResponseError(
            error
          )
        );
      } finally {
        setSending(
          false
        );
      }
    };

  /* =========================================
     LOADING
  ========================================= */

  if (
    loading
  ) {
    return (
      <main className="public-budget-page">

        <div className="public-budget-shell">

          <section className="public-budget-loading">

            <div className="public-budget-loader" />

            <strong>
              Cargando presupuesto
            </strong>

            <span>
              Estamos recuperando la información de tu presupuesto.
            </span>

          </section>

        </div>

      </main>
    );
  }

  /* =========================================
     ERROR
  ========================================= */

  if (
    loadError ||
    !budget
  ) {
    return (
      <main className="public-budget-page">

        <div className="public-budget-shell">

          <section className="public-budget-error-state">

            <div className="public-budget-error-icon">
              <AlertTriangle
                size={27}
              />
            </div>

            <span>
              Presupuesto
            </span>

            <h1>
              Enlace no disponible
            </h1>

            <p>
              {loadError ||
                "No pudimos encontrar este presupuesto."}
            </p>

            <small>
              Si recibiste este enlace recientemente, contactá al servicio técnico para solicitar uno nuevo.
            </small>

          </section>

        </div>

      </main>
    );
  }

  /* =========================================
     RENDER
  ========================================= */

  return (
    <main className="public-budget-page">

      <div className="public-budget-shell">

        {/* =================================
            BRAND
        ================================= */}

        <header className="public-budget-brand">

          <div className="public-budget-brand-logo">

            <Wrench
              size={21}
            />

          </div>

          <div>

            <strong>
              Servicio Técnico
            </strong>

            <span>
              Presupuesto digital
            </span>

          </div>

          <div className="public-budget-secure">

            <ShieldCheck
              size={15}
            />

            Enlace seguro

          </div>

        </header>

        {/* =================================
            HERO
        ================================= */}

        <motion.section
          className="public-budget-hero"
          initial={{
            opacity: 0,
            y: 8,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.25,
          }}
        >

          <div className="public-budget-hero-icon">

            <ClipboardCheck
              size={23}
            />

          </div>

          <div className="public-budget-hero-copy">

            <span>
              Presupuesto
            </span>

            <h1>
              {budget.numero ||
                budget.presupuestoId}
            </h1>

            <p>
              Hola{" "}
              <strong>
                {budget.cliente ||
                  "cliente"}
              </strong>
              , revisá el detalle del trabajo antes de confirmar tu decisión.
            </p>

          </div>

          <BudgetStatus
            budget={
              budget
            }
            expired={
              expired
            }
          />

        </motion.section>

        {/* =================================
            RESPUESTA EXISTENTE
        ================================= */}

        {responded && (
          <motion.section
            className={
              budget.respuesta ===
              "Aceptado"
                ? "public-budget-response accepted"
                : "public-budget-response rejected"
            }
            initial={{
              opacity: 0,
              y: 6,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
          >

            <div>

              {budget.respuesta ===
              "Aceptado" ? (
                <CheckCircle2
                  size={23}
                />
              ) : (
                <XCircle
                  size={23}
                />
              )}

            </div>

            <div>

              <span>
                Respuesta registrada
              </span>

              <h2>
                {budget.respuesta ===
                "Aceptado"
                  ? "Presupuesto aceptado"
                  : "Presupuesto rechazado"}
              </h2>

              <p>
                {budget.respuesta ===
                "Aceptado"
                  ? "Gracias. Tu aprobación fue registrada correctamente."
                  : "Tu rechazo fue registrado correctamente."}
              </p>

              {budget.respondidoEn && (
                <small>
                  {formatDateTime(
                    budget.respondidoEn
                  )}
                </small>
              )}

            </div>

          </motion.section>
        )}

        {/* =================================
            VENCIDO
        ================================= */}

        {expired &&
          !responded && (
            <section className="public-budget-expired">

              <Clock3
                size={19}
              />

              <div>

                <strong>
                  Presupuesto vencido
                </strong>

                <span>
                  La vigencia finalizó el{" "}
                  {formatDate(
                    budget.fechaVencimiento
                  )}.
                  Solicitá una actualización antes de confirmar el trabajo.
                </span>

              </div>

            </section>
          )}

        {/* =================================
            DESHABILITADO
        ================================= */}

        {disabled &&
          !responded && (
            <section className="public-budget-disabled">

              <CircleX
                size={19}
              />

              <div>

                <strong>
                  Enlace deshabilitado
                </strong>

                <span>
                  Este presupuesto ya no acepta respuestas mediante este enlace.
                </span>

              </div>

            </section>
          )}

        {/* =================================
            INFORMACIÓN
        ================================= */}

        <div className="public-budget-layout">

          <div className="public-budget-main">

            {/* DATOS GENERALES */}

            <section className="public-budget-card">

              <div className="public-budget-card-head">

                <FileText
                  size={18}
                />

                <div>

                  <span>
                    Información
                  </span>

                  <h2>
                    Datos del presupuesto
                  </h2>

                </div>

              </div>

              <div className="public-budget-info-grid">

                <div>

                  <span>
                    Fecha
                  </span>

                  <strong>
                    {formatDate(
                      budget.fecha
                    )}
                  </strong>

                </div>

                <div>

                  <span>
                    Válido hasta
                  </span>

                  <strong>
                    {formatDate(
                      budget.fechaVencimiento
                    )}
                  </strong>

                </div>

                <div>

                  <span>
                    Origen
                  </span>

                  <strong>
                    {budget.origen ||
                      "Manual"}
                  </strong>

                </div>

                {budget.ticketNumero && (
                  <div>

                    <span>
                      Ticket
                    </span>

                    <strong>
                      {
                        budget.ticketNumero
                      }
                    </strong>

                  </div>
                )}

              </div>

            </section>

            {/* EQUIPO */}

            {(budget.equipo ||
              budget.falla ||
              budget.diagnostico) && (
              <section className="public-budget-card">

                <div className="public-budget-card-head">

                  <Laptop
                    size={18}
                  />

                  <div>

                    <span>
                      Servicio técnico
                    </span>

                    <h2>
                      Equipo y diagnóstico
                    </h2>

                  </div>

                </div>

                <div className="public-budget-device">

                  {budget.equipo && (
                    <div className="public-budget-device-main">

                      <span>
                        Equipo
                      </span>

                      <strong>
                        {
                          budget.equipo
                        }
                      </strong>

                    </div>
                  )}

                  {budget.falla && (
                    <div className="public-budget-text-block">

                      <span>
                        Falla informada
                      </span>

                      <p>
                        {
                          budget.falla
                        }
                      </p>

                    </div>
                  )}

                  {budget.diagnostico && (
                    <div className="public-budget-text-block diagnostic">

                      <span>
                        Diagnóstico técnico
                      </span>

                      <p>
                        {
                          budget.diagnostico
                        }
                      </p>

                    </div>
                  )}

                </div>

              </section>
            )}

            {/* CONCEPTOS */}

            <section className="public-budget-card">

              <div className="public-budget-card-head">

                <ReceiptText
                  size={18}
                />

                <div>

                  <span>
                    Detalle
                  </span>

                  <h2>
                    Trabajo presupuestado
                  </h2>

                </div>

              </div>

              <div className="public-budget-items">

                {items.length ===
                0 ? (
                  <div className="public-budget-no-items">
                    No hay conceptos detallados.
                  </div>
                ) : (
                  items.map(
                    (
                      item,
                      index
                    ) => (
                      <article
                        className="public-budget-item"
                        key={
                          `${
                            item.descripcion ||
                            "item"
                          }-${index}`
                        }
                      >

                        <div className="public-budget-item-index">
                          {index + 1}
                        </div>

                        <div className="public-budget-item-copy">

                          <strong>
                            {item.descripcion ||
                              "Concepto"}
                          </strong>

                          <span>
                            {Number(
                              item.cantidad ||
                              1
                            )}{" "}
                            ×{" "}
                            {formatMoney(
                              item.precio
                            )}
                          </span>

                        </div>

                        <strong className="public-budget-item-total">
                          {formatMoney(
                            item.subtotal ??
                              Number(
                                item.cantidad ||
                                1
                              ) *
                                Number(
                                  item.precio ||
                                  0
                                )
                          )}
                        </strong>

                      </article>
                    )
                  )
                )}

              </div>

            </section>

            {/* OBSERVACIONES */}

            {budget.observaciones && (
              <section className="public-budget-card">

                <div className="public-budget-card-head">

                  <AlertTriangle
                    size={18}
                  />

                  <div>

                    <span>
                      Aclaraciones
                    </span>

                    <h2>
                      Observaciones
                    </h2>

                  </div>

                </div>

                <div className="public-budget-observations">
                  {
                    budget.observaciones
                  }
                </div>

              </section>
            )}

          </div>

          {/* =================================
              RESUMEN
          ================================= */}

          <aside className="public-budget-sidebar">

            <section className="public-budget-total-card">

              <div className="public-budget-total-head">

                <span>
                  Resumen
                </span>

                <h2>
                  Total presupuestado
                </h2>

              </div>

              <div className="public-budget-total-body">

                <div>

                  <span>
                    Subtotal
                  </span>

                  <strong>
                    {formatMoney(
                      budget.subtotal
                    )}
                  </strong>

                </div>

                {discount > 0 && (
                  <div className="discount">

                    <span>
                      Descuento

                      {Number(
                        budget.descuentoPorcentaje ||
                        0
                      ) >
                        0 &&
                        ` (${budget.descuentoPorcentaje}%)`}
                    </span>

                    <strong>
                      -
                      {formatMoney(
                        discount
                      )}
                    </strong>

                  </div>
                )}

                <div className="public-budget-final-total">

                  <span>
                    Total
                  </span>

                  <strong>
                    {formatMoney(
                      budget.total
                    )}
                  </strong>

                </div>

              </div>

              {canRespond && (
                <div className="public-budget-actions">

                  <p>
                    Indicá si autorizás la realización del trabajo presupuestado.
                  </p>

                  <motion.button
                    type="button"
                    className="public-budget-accept"
                    whileHover={{
                      y: -1,
                    }}
                    whileTap={{
                      scale:
                        0.98,
                    }}
                    onClick={() =>
                      openDecision(
                        "accept"
                      )
                    }
                  >

                    <Check
                      size={18}
                    />

                    Aceptar presupuesto

                  </motion.button>

                  <button
                    type="button"
                    className="public-budget-reject"
                    onClick={() =>
                      openDecision(
                        "reject"
                      )
                    }
                  >

                    <X
                      size={17}
                    />

                    Rechazar

                  </button>

                </div>
              )}

              {responded && (
                <div
                  className={
                    budget.respuesta ===
                    "Aceptado"
                      ? "public-budget-locked accepted"
                      : "public-budget-locked rejected"
                  }
                >

                  {budget.respuesta ===
                  "Aceptado" ? (
                    <CheckCircle2
                      size={17}
                    />
                  ) : (
                    <XCircle
                      size={17}
                    />
                  )}

                  <span>
                    Este presupuesto ya fue respondido.
                  </span>

                </div>
              )}

              {expired &&
                !responded && (
                  <div className="public-budget-locked expired">

                    <Clock3
                      size={17}
                    />

                    <span>
                      La vigencia del presupuesto finalizó.
                    </span>

                  </div>
                )}

            </section>

            <div className="public-budget-security-note">

              <ShieldCheck
                size={17}
              />

              <div>

                <strong>
                  Respuesta digital
                </strong>

                <span>
                  Tu decisión queda registrada junto con la fecha y hora de confirmación.
                </span>

              </div>

            </div>

          </aside>

        </div>

        {/* =================================
            FOOTER
        ================================= */}

        <footer className="public-budget-footer">

          <ShieldCheck
            size={14}
          />

          <span>
            Este enlace muestra únicamente la información necesaria del presupuesto.
          </span>

        </footer>

      </div>

      {/* =================================
          MODAL CONFIRMACIÓN
      ================================= */}

      {decision && (
        <div
          className="public-budget-modal-overlay"
          onMouseDown={
            (
              event
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeDecision();
              }
            }
          }
        >

          <motion.div
            className="public-budget-modal"
            initial={{
              opacity: 0,
              scale: 0.96,
              y: 8,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            transition={{
              duration:
                0.18,
            }}
          >

            <div
              className={
                decision ===
                "accept"
                  ? "public-budget-modal-icon accept"
                  : "public-budget-modal-icon reject"
              }
            >

              {decision ===
              "accept" ? (
                <CheckCircle2
                  size={25}
                />
              ) : (
                <XCircle
                  size={25}
                />
              )}

            </div>

            <span className="public-budget-modal-label">
              Confirmación
            </span>

            <h2>
              {decision ===
              "accept"
                ? "¿Aceptar este presupuesto?"
                : "¿Rechazar este presupuesto?"}
            </h2>

            <p>
              {decision ===
              "accept"
                ? `Confirmás la autorización del trabajo por ${formatMoney(
                    budget.total
                  )}.`
                : "Confirmás que no autorizás la realización del trabajo presupuestado."}
            </p>

            <div className="public-budget-modal-summary">

              <span>
                {budget.numero ||
                  budget.presupuestoId}
              </span>

              <strong>
                {formatMoney(
                  budget.total
                )}
              </strong>

            </div>

            {responseError && (
              <div className="public-budget-modal-error">

                <AlertTriangle
                  size={16}
                />

                <span>
                  {
                    responseError
                  }
                </span>

              </div>
            )}

            <div className="public-budget-modal-actions">

              <button
                type="button"
                className="public-budget-modal-cancel"
                disabled={
                  sending
                }
                onClick={
                  closeDecision
                }
              >
                Volver
              </button>

              <button
                type="button"
                className={
                  decision ===
                  "accept"
                    ? "public-budget-modal-confirm accept"
                    : "public-budget-modal-confirm reject"
                }
                disabled={
                  sending
                }
                onClick={
                  confirmDecision
                }
              >

                {decision ===
                "accept" ? (
                  <Check
                    size={17}
                  />
                ) : (
                  <X
                    size={17}
                  />
                )}

                {sending
                  ? "Registrando..."
                  : decision ===
                    "accept"
                    ? "Sí, aceptar"
                    : "Sí, rechazar"}

              </button>

            </div>

          </motion.div>

        </div>
      )}

    </main>
  );
}

/* =========================================
   STATUS
========================================= */

function BudgetStatus({
  budget,
  expired,
}) {
  if (
    budget.respuesta ===
    "Aceptado"
  ) {
    return (
      <span className="public-budget-status accepted">

        <CheckCircle2
          size={14}
        />

        Aceptado

      </span>
    );
  }

  if (
    budget.respuesta ===
    "Rechazado"
  ) {
    return (
      <span className="public-budget-status rejected">

        <XCircle
          size={14}
        />

        Rechazado

      </span>
    );
  }

  if (
    expired
  ) {
    return (
      <span className="public-budget-status expired">

        <Clock3
          size={14}
        />

        Vencido

      </span>
    );
  }

  if (
    budget.activo ===
    false
  ) {
    return (
      <span className="public-budget-status disabled">

        <CircleX
          size={14}
        />

        No disponible

      </span>
    );
  }

  return (
    <span className="public-budget-status pending">

      <CalendarDays
        size={14}
      />

      Pendiente

    </span>
  );
}