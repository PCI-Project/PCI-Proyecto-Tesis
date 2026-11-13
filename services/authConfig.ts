// Ajustes del flujo de cuentas.
// EMAIL_DELIVERY_ENABLED: en false (modo local) la app muestra el aviso de "hemos enviado un correo",
// pero no envía nada. Al desplegar con servidor de correo se pone en true y se quita la nota de modo local.
export const EMAIL_DELIVERY_ENABLED = false;

// Vigencia del enlace de restablecimiento que enviará el servidor (OWASP: corta, de un solo uso).
export const RESET_LINK_MINUTES = 30;

// Espera mínima antes de permitir "Reenviar correo".
export const RESEND_COOLDOWN_SECONDS = 60;

// Intentos fallidos antes de bloquear temporalmente el inicio de sesión o el uso del código de recuperación.
export const MAX_FAILED_ATTEMPTS = 5;
