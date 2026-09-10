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
  BriefcaseBusiness,
  CalendarClock,
  ChartLine,
  CircleDollarSign,
  Handshake,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import {
  CRM_STAGES,
  createOpportunity,
  deleteOpportunity,
  subscribeToCRM,
  updateOpportunity,
  updateOpportunityStage,
} from "../../services/crm.service.js";

import {
  notify,
} from "../../services/notifications.js";

import "./CRM.css";

const EMPTY_FORM = {
  contacto: "",
  empresa: "",
  interes: "",
  valor: "",
  fecha: "",
  stage: "prospecto",
};

function formatMoney(value) {
  return new Intl.NumberFormat(
    "es-AR",
    {
      style:
        "currency",

      currency:
        "ARS",

      maximumFractionDigits:
        0,
    }
  ).format(
    Number(
      value ||
      0
    )
  );
}

function getStageLabel(stage) {
  return (
    CRM_STAGES.find(
      (item) =>
        item.key ===
        stage
    )?.label ||
    stage ||
    "Prospecto"
  );
}

function errorMessage(error) {
  const map = {
    CRM_CONTACT_REQUIRED:
      "Ingresá el nombre del contacto.",

    CRM_INTEREST_REQUIRED:
      "Indicá el interés o necesidad comercial.",

    CRM_ID_REQUIRED:
      "No pudimos identificar la oportunidad.",
  };

  return (
    map[
      error?.message
    ] ||
    error?.message ||
    "Ocurrió un error inesperado."
  );
}

export default function CRM() {
  const navigate =
    useNavigate();

  const {
    profile,
    user,
  } =
    useAuth();

  const author =
    profile?.nombre ||
    profile?.name ||
    user?.email ||
    "Sistema";

  const [
    opportunities,
    setOpportunities,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    modalOpen,
    setModalOpen,
  ] =
    useState(false);

  const [
    editingOpportunity,
    setEditingOpportunity,
  ] =
    useState(null);

  const [
    form,
    setForm,
  ] =
    useState(
      EMPTY_FORM
    );

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    movingId,
    setMovingId,
  ] =
    useState(null);

  const [
    draggingId,
    setDraggingId,
  ] =
    useState(null);

  /* =======================================
     FIRESTORE
  ======================================= */

  useEffect(
    () => {
      const unsubscribe =
        subscribeToCRM(
          (rows) => {
            setOpportunities(
              rows
            );

            setLoading(
              false
            );
          },

          (error) => {
            console.error(
              error
            );

            setLoading(
              false
            );

            notify.error(
              "CRM",
              "No se pudieron cargar las oportunidades."
            );
          }
        );

      return unsubscribe;
    },
    []
  );

  /* =======================================
     FILTRO
  ======================================= */

  const filtered =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        if (
          !query
        ) {
          return opportunities;
        }

        return opportunities.filter(
          (
            opportunity
          ) =>
            [
              opportunity.contacto,
              opportunity.empresa,
              opportunity.interes,
              opportunity.fecha,
              getStageLabel(
                opportunity.stage
              ),
            ]
              .filter(
                Boolean
              )
              .join(
                " "
              )
              .toLowerCase()
              .includes(
                query
              )
        );
      },
      [
        opportunities,
        search,
      ]
    );

  /* =======================================
     MÉTRICAS
  ======================================= */

  const metrics =
    useMemo(
      () => {
        const active =
          opportunities.filter(
            (
              opportunity
            ) =>
              opportunity.stage !==
              "perdido"
          );

        const pipeline =
          active.reduce(
            (
              sum,
              opportunity
            ) =>
              sum +
              Number(
                opportunity.valor ||
                0
              ),
            0
          );

        const won =
          opportunities.filter(
            (
              opportunity
            ) =>
              opportunity.stage ===
              "ganado"
          );

        const wonValue =
          won.reduce(
            (
              sum,
              opportunity
            ) =>
              sum +
              Number(
                opportunity.valor ||
                0
              ),
            0
          );

        const negotiation =
          opportunities.filter(
            (
              opportunity
            ) =>
              opportunity.stage ===
                "propuesta" ||
              opportunity.stage ===
                "negociacion"
          ).length;

        return {
          total:
            opportunities.length,

          pipeline,

          won:
            won.length,

          wonValue,

          negotiation,
        };
      },
      [
        opportunities,
      ]
    );

  /* =======================================
     MODAL
  ======================================= */

  const openNew =
    () => {
      setEditingOpportunity(
        null
      );

      setForm(
        EMPTY_FORM
      );

      setModalOpen(
        true
      );
    };

  const openEdit =
    (
      opportunity
    ) => {
      setEditingOpportunity(
        opportunity
      );

      setForm({
        contacto:
          opportunity.contacto ||
          "",

        empresa:
          opportunity.empresa ===
          "—"
            ? ""
            : opportunity.empresa ||
              "",

        interes:
          opportunity.interes ||
          "",

        valor:
          opportunity.valor ??
          "",

        fecha:
          opportunity.fecha ===
          "Sin fecha"
            ? ""
            : opportunity.fecha ||
              "",

        stage:
          opportunity.stage ||
          "prospecto",
      });

      setModalOpen(
        true
      );
    };

  const closeModal =
    () => {
      if (
        saving
      ) {
        return;
      }

      setModalOpen(
        false
      );

      setEditingOpportunity(
        null
      );

      setForm(
        EMPTY_FORM
      );
    };

  /* =======================================
     GUARDAR
  ======================================= */

  const handleSave =
    async () => {
      try {
        setSaving(
          true
        );

        if (
          editingOpportunity
        ) {
          await updateOpportunity(
            editingOpportunity.id,

            {
              ...form,
              author,
            }
          );

          if (
            form.stage !==
            editingOpportunity.stage
          ) {
            await updateOpportunityStage(
              editingOpportunity,
              form.stage,
              author
            );
          }

          notify.success(
            "Oportunidad actualizada",
            "Los cambios se guardaron correctamente."
          );
        } else {
          await createOpportunity({
            ...form,
            author,
          });

          notify.success(
            "Oportunidad creada",
            "La oportunidad quedó agregada al pipeline."
          );
        }

        closeModal();
      } catch (
        error
      ) {
        console.error(
          error
        );

        notify.error(
          "No se pudo guardar",
          errorMessage(
            error
          )
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /* =======================================
     MOVER
  ======================================= */

  const handleMove =
    async (
      opportunity,
      stage
    ) => {
      if (
        !opportunity ||
        opportunity.stage ===
          stage
      ) {
        return;
      }

      try {
        setMovingId(
          opportunity.id
        );

        await updateOpportunityStage(
          opportunity,
          stage,
          author
        );

        notify.success(
          "Etapa actualizada",
          `${opportunity.contacto} pasó a ${getStageLabel(
            stage
          )}.`
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        notify.error(
          "No se pudo mover",
          errorMessage(
            error
          )
        );
      } finally {
        setMovingId(
          null
        );
      }
    };

  /* =======================================
     ELIMINAR
  ======================================= */

  const handleDelete =
    async (
      opportunity
    ) => {
      const confirmed =
        window.confirm(
          `¿Eliminar la oportunidad de ${opportunity.contacto}?\n\nEsta acción elimina el registro del CRM.`
        );

      if (
        !confirmed
      ) {
        return;
      }

      try {
        await deleteOpportunity(
          opportunity.id
        );

        notify.success(
          "Oportunidad eliminada",
          "El registro fue eliminado del CRM."
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        notify.error(
          "No se pudo eliminar",
          errorMessage(
            error
          )
        );
      }
    };

  /* =========================================
     RENDER
  ========================================= */

  return (
    <main className="crm-page">
      <div className="crm-shell">

        <header className="crm-header">
          <div>
            <button
              type="button"
              className="crm-back"
              onClick={() =>
                navigate(
                  "/dashboard"
                )
              }
            >
              <ArrowLeft
                size={17}
              />
              Dashboard
            </button>

            <span className="crm-eyebrow">
              Comercial / Seguimiento
            </span>

            <h1>
              CRM y Oportunidades
            </h1>

            <p>
              Seguimiento del pipeline comercial desde el primer contacto hasta el cierre.
            </p>
          </div>

          <button
            type="button"
            className="crm-primary"
            onClick={
              openNew
            }
          >
            <Plus
              size={17}
            />
            Nueva oportunidad
          </button>
        </header>

        <section className="crm-metrics">
          <article>
            <span>
              <Target
                size={17}
              />
              Oportunidades
            </span>

            <strong>
              {
                metrics.total
              }
            </strong>

            <small>
              Total registradas
            </small>
          </article>

          <article>
            <span>
              <CircleDollarSign
                size={17}
              />
              Pipeline activo
            </span>

            <strong>
              {formatMoney(
                metrics.pipeline
              )}
            </strong>

            <small>
              Excluye perdidas
            </small>
          </article>

          <article>
            <span>
              <Handshake
                size={17}
              />
              En negociación
            </span>

            <strong>
              {
                metrics.negotiation
              }
            </strong>

            <small>
              Propuesta + negociación
            </small>
          </article>

          <article>
            <span>
              <ChartLine
                size={17}
              />
              Ganadas
            </span>

            <strong>
              {
                metrics.won
              }
            </strong>

            <small>
              {formatMoney(
                metrics.wonValue
              )}
            </small>
          </article>
        </section>

        <section className="crm-panel">
          <div className="crm-toolbar">
            <div>
              <span>
                Pipeline
              </span>

              <h2>
                Oportunidades comerciales
              </h2>
            </div>

            <label className="crm-search">
              <Search
                size={16}
              />

              <input
                value={
                  search
                }
                placeholder="Contacto, empresa, interés..."
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
                  )
                }
              />
            </label>
          </div>

          {loading ? (
            <div className="crm-loading">
              Cargando oportunidades...
            </div>
          ) : (
            <div className="crm-board">
              {CRM_STAGES.map(
                (
                  stage
                ) => {
                  const stageItems =
                    filtered.filter(
                      (
                        opportunity
                      ) =>
                        opportunity.stage ===
                        stage.key
                    );

                  const stageTotal =
                    stageItems.reduce(
                      (
                        sum,
                        opportunity
                      ) =>
                        sum +
                        Number(
                          opportunity.valor ||
                          0
                        ),
                      0
                    );

                  return (
                    <section
                      key={
                        stage.key
                      }
                      className={`crm-column crm-column-${stage.key}`}
                      onDragOver={(
                        event
                      ) =>
                        event.preventDefault()
                      }
                      onDrop={() => {
                        const opportunity =
                          opportunities.find(
                            (
                              item
                            ) =>
                              item.id ===
                              draggingId
                          );

                        if (
                          opportunity
                        ) {
                          handleMove(
                            opportunity,
                            stage.key
                          );
                        }

                        setDraggingId(
                          null
                        );
                      }}
                    >
                      <header>
                        <div>
                          <span className="crm-dot" />

                          <strong>
                            {
                              stage.label
                            }
                          </strong>

                          <b>
                            {
                              stageItems.length
                            }
                          </b>
                        </div>

                        <small>
                          {formatMoney(
                            stageTotal
                          )}
                        </small>
                      </header>

                      <div className="crm-cards">
                        {stageItems.map(
                          (
                            opportunity
                          ) => (
                            <motion.article
                              layout
                              key={
                                opportunity.id
                              }
                              className={`crm-card ${
                                movingId ===
                                opportunity.id
                                  ? "is-moving"
                                  : ""
                              }`}
                              draggable
                              onDragStart={() =>
                                setDraggingId(
                                  opportunity.id
                                )
                              }
                              onDragEnd={() =>
                                setDraggingId(
                                  null
                                )
                              }
                              initial={{
                                opacity:
                                  0,

                                y:
                                  8,
                              }}
                              animate={{
                                opacity:
                                  1,

                                y:
                                  0,
                              }}
                            >
                              <div className="crm-card-head">
                                <div className="crm-card-avatar">
                                  <UserRound
                                    size={16}
                                  />
                                </div>

                                <div>
                                  <strong>
                                    {
                                      opportunity.contacto
                                    }
                                  </strong>

                                  <span>
                                    {
                                      opportunity.empresa ||
                                      "—"
                                    }
                                  </span>
                                </div>

                                <div className="crm-card-actions">
                                  <button
                                    type="button"
                                    title="Editar"
                                    onClick={() =>
                                      openEdit(
                                        opportunity
                                      )
                                    }
                                  >
                                    <Pencil
                                      size={14}
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    title="Eliminar"
                                    onClick={() =>
                                      handleDelete(
                                        opportunity
                                      )
                                    }
                                  >
                                    <Trash2
                                      size={14}
                                    />
                                  </button>
                                </div>
                              </div>

                              <p>
                                {
                                  opportunity.interes
                                }
                              </p>

                              <div className="crm-card-meta">
                                <span>
                                  <CircleDollarSign
                                    size={14}
                                  />

                                  {formatMoney(
                                    opportunity.valor
                                  )}
                                </span>

                                <span>
                                  <CalendarClock
                                    size={14}
                                  />

                                  {
                                    opportunity.fecha ||
                                    "Sin fecha"
                                  }
                                </span>
                              </div>

                              <select
                                value={
                                  opportunity.stage
                                }
                                disabled={
                                  movingId ===
                                  opportunity.id
                                }
                                onChange={(
                                  event
                                ) =>
                                  handleMove(
                                    opportunity,
                                    event.target.value
                                  )
                                }
                              >
                                {CRM_STAGES.map(
                                  (
                                    option
                                  ) => (
                                    <option
                                      key={
                                        option.key
                                      }
                                      value={
                                        option.key
                                      }
                                    >
                                      {
                                        option.label
                                      }
                                    </option>
                                  )
                                )}
                              </select>
                            </motion.article>
                          )
                        )}

                        {!stageItems.length && (
                          <div className="crm-column-empty">
                            <BriefcaseBusiness
                              size={21}
                            />

                            <span>
                              Sin oportunidades
                            </span>
                          </div>
                        )}
                      </div>
                    </section>
                  );
                }
              )}
            </div>
          )}
        </section>
      </div>

      {modalOpen && (
        <div
          className="crm-modal-overlay"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
                event.currentTarget &&
              !saving
            ) {
              closeModal();
            }
          }}
        >
          <motion.div
            className="crm-modal"
            initial={{
              opacity:
                0,

              scale:
                0.98,

              y:
                8,
            }}
            animate={{
              opacity:
                1,

              scale:
                1,

              y:
                0,
            }}
          >
            <header>
              <div>
                <span>
                  CRM
                </span>

                <h3>
                  {editingOpportunity
                    ? "Editar oportunidad"
                    : "Nueva oportunidad"}
                </h3>
              </div>

              <button
                type="button"
                disabled={
                  saving
                }
                onClick={
                  closeModal
                }
              >
                <X
                  size={18}
                />
              </button>
            </header>

            <div className="crm-form">
              <label className="wide">
                <span>
                  Contacto *
                </span>

                <input
                  value={
                    form.contacto
                  }
                  placeholder="Nombre del contacto"
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,

                        contacto:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label className="wide">
                <span>
                  Empresa
                </span>

                <input
                  value={
                    form.empresa
                  }
                  placeholder="Empresa (opcional)"
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,

                        empresa:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label className="wide">
                <span>
                  Interés / oportunidad *
                </span>

                <textarea
                  rows="3"
                  value={
                    form.interes
                  }
                  placeholder="Ej: Contrato de mantenimiento mensual"
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,

                        interes:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Valor estimado
                </span>

                <input
                  type="number"
                  min="0"
                  value={
                    form.valor
                  }
                  placeholder="0"
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,

                        valor:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Próximo contacto
                </span>

                <input
                  value={
                    form.fecha
                  }
                  placeholder="Ej: 15 Sep"
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,

                        fecha:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label className="wide">
                <span>
                  Etapa
                </span>

                <select
                  value={
                    form.stage
                  }
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,

                        stage:
                          event.target.value,
                      })
                    )
                  }
                >
                  {CRM_STAGES.map(
                    (
                      stage
                    ) => (
                      <option
                        key={
                          stage.key
                        }
                        value={
                          stage.key
                        }
                      >
                        {
                          stage.label
                        }
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            <footer>
              <button
                type="button"
                className="ghost"
                disabled={
                  saving
                }
                onClick={
                  closeModal
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="primary"
                disabled={
                  saving
                }
                onClick={
                  handleSave
                }
              >
                {saving
                  ? "Guardando..."
                  : editingOpportunity
                    ? "Guardar cambios"
                    : "Crear oportunidad"}
              </button>
            </footer>
          </motion.div>
        </div>
      )}
    </main>
  );
}
