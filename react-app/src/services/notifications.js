import { sileo } from "sileo";

/* =========================================
   HELPERS
========================================= */

function buildToastOptions(
  title,
  description = "",
  options = {}
) {
  return {
    title,
    ...(description ? { description } : {}),
    ...options,
  };
}

function resolveDescription(value, payload) {
  if (typeof value === "function") {
    return value(payload);
  }

  return value || "";
}

/* =========================================
   NOTIFICACIONES
========================================= */

export const notify = {
  /* =======================================
     SUCCESS
  ======================================= */

  success(
    title,
    description = "",
    options = {}
  ) {
    return sileo.success(
      buildToastOptions(
        title,
        description,
        options
      )
    );
  },

  /* =======================================
     ERROR
  ======================================= */

  error(
    title,
    description = "",
    options = {}
  ) {
    return sileo.error(
      buildToastOptions(
        title,
        description,
        {
          duration: 7000,
          ...options,
        }
      )
    );
  },

  /* =======================================
     WARNING
  ======================================= */

  warning(
    title,
    description = "",
    options = {}
  ) {
    return sileo.warning(
      buildToastOptions(
        title,
        description,
        {
          duration: 6500,
          ...options,
        }
      )
    );
  },

  /* =======================================
     INFO
  ======================================= */

  info(
    title,
    description = "",
    options = {}
  ) {
    return sileo.info(
      buildToastOptions(
        title,
        description,
        options
      )
    );
  },

  /* =======================================
     ACTION
  ======================================= */

  action(
    title,
    description = "",
    button,
    options = {}
  ) {
    return sileo.action({
      title,

      ...(description
        ? { description }
        : {}),

      button,

      duration: 8000,

      ...options,
    });
  },

  /* =======================================
     CUSTOM / ICON
  ======================================= */

  custom(
    title,
    description = "",
    options = {}
  ) {
    return sileo.show({
      title,

      ...(description
        ? { description }
        : {}),

      ...options,
    });
  },

  /* =======================================
     PROMISE
  ======================================= */

  promise(
    promise,
    {
      loadingTitle = "Procesando...",
      loadingDescription = "",

      successTitle = "Operación completada",
      successDescription = "",

      errorTitle = "No se pudo completar",
      errorDescription = (error) =>
        error?.message ||
        "Ocurrió un error inesperado.",

      position = "top-right",

      loadingOptions = {},
      successOptions = {},
      errorOptions = {},
    } = {}
  ) {
    return sileo.promise(
      promise,
      {
        loading: {
          title:
            loadingTitle,

          ...(loadingDescription
            ? {
                description:
                  loadingDescription,
              }
            : {}),

          ...loadingOptions,
        },

        success: (data) => ({
          title:
            typeof successTitle ===
            "function"
              ? successTitle(data)
              : successTitle,

          ...(resolveDescription(
            successDescription,
            data
          )
            ? {
                description:
                  resolveDescription(
                    successDescription,
                    data
                  ),
              }
            : {}),

          ...successOptions,
        }),

        error: (error) => ({
          title:
            typeof errorTitle ===
            "function"
              ? errorTitle(error)
              : errorTitle,

          ...(resolveDescription(
            errorDescription,
            error
          )
            ? {
                description:
                  resolveDescription(
                    errorDescription,
                    error
                  ),
              }
            : {}),

          duration: 7000,

          ...errorOptions,
        }),

        position,
      }
    );
  },

  /* =======================================
     DISMISS
  ======================================= */

  dismiss(id) {
    sileo.dismiss(id);
  },

  /* =======================================
     CLEAR
  ======================================= */

  clear(position) {
    sileo.clear(position);
  },
};

export default notify;