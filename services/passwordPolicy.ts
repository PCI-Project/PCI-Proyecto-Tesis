// Política de contraseñas según NIST SP 800-63B y OWASP ASVS:
// - largo mínimo de 8 caracteres (NIST recomienda 15 cuando la contraseña es el único factor) y sin máximo bajo;
// - sin reglas de composición obligatorias (mayúsculas, símbolos…);
// - rechazo de contraseñas comunes, triviales o relacionadas con el usuario o el servicio.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_RECOMMENDED_LENGTH = 15;

const COMMON_PASSWORDS = new Set([
  '123456', '1234567', '12345678', '123456789', '1234567890', '0123456789', '12341234', '11111111', '00000000', '87654321',
  '123123123', '112233', '121212', '123321', '654321', '666666', '777777', '888888', '999999', '000000',
  'password', 'password1', 'password123', 'passw0rd', 'p@ssw0rd', 'qwerty', 'qwerty123', 'qwertyuiop', 'qwerty12', 'qazwsx',
  'qazwsxedc', '1qaz2wsx', '1q2w3e4r', '1q2w3e4r5t', 'q1w2e3r4', 'asdfghjk', 'asdfasdf', 'zxcvbnm', 'zxcvbnm1', '12qwaszx',
  'abc123', 'abc12345', 'abcd1234', 'abcdefgh', 'aa123456', 'a12345678', '12345678a', '1a2b3c4d', 'test1234', 'testing',
  'iloveyou', 'loveyou', 'admin', 'admin123', 'administrator', 'root', 'guest', 'default', 'changeme', 'welcome',
  'welcome1', 'letmein', 'monkey', 'dragon', 'football', 'baseball', 'sunshine', 'princess', 'superman', 'batman',
  'master', 'shadow', 'michael', 'jordan23', 'charlie', 'freedom', 'whatever', 'starwars', 'pokemon', 'minecraft',
  'computer', 'internet', 'samsung', 'google', 'facebook', 'iphone', 'trustno1', 'hello123',
  'contraseña', 'contrasena', 'contraseña1', 'contrasena1', 'micontraseña', 'micontrasena', 'clave123', 'clave1234',
  'teamo', 'teamo123', 'tequiero', 'panama', 'panama123', 'panama2025', 'panama2026', 'veraguas', 'santiago',
  'universidad', 'utp12345', 'utp2025', 'utp2026', 'ingenieria', 'ingeniero', 'ingcivil', 'asfalto', 'pavimento',
  'asphalt', 'asphaltpci', 'asphaltpcipro', 'pci12345', 'pcipro', 'astmd6433',
]);

const isSequence = (value: string) => {
  if (value.length < 4) return false;
  const codes = Array.from(value, char => char.charCodeAt(0));
  const step = codes[1] - codes[0];
  return (step === 1 || step === -1) && codes.every((code, index) => index === 0 || code - codes[index - 1] === step);
};

export type PasswordProblem = 'auth.errorPasswordLength' | 'auth.errorPasswordCommon' | 'auth.errorPasswordPersonal';

// Devuelve la clave de traducción del problema, o null si la contraseña es aceptable
export const validateNewPassword = (password: string, context: { email?: string; name?: string } = {}): PasswordProblem | null => {
  if (password.length < PASSWORD_MIN_LENGTH) return 'auth.errorPasswordLength';
  const lower = password.toLowerCase();
  const compact = lower.replace(/[\s._-]/g, '');
  if (COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(compact)) return 'auth.errorPasswordCommon';
  if (/^(.)\1+$/.test(compact) || isSequence(compact)) return 'auth.errorPasswordCommon';
  const personal = [
    (context.email || '').split('@')[0],
    ...(context.name || '').split(/\s+/),
  ].map(part => part.toLowerCase().trim()).filter(part => part.length >= 4);
  if (personal.some(part => compact.includes(part))) return 'auth.errorPasswordPersonal';
  return null;
};
