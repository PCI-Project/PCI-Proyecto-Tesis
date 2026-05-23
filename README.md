# Guía para colaboradores después de clonar el repositorio

Este documento describe los pasos que debe seguir cada integrante del equipo después de clonar el repositorio del proyecto para poder ejecutar el backend de forma segura y conectarse correctamente a MongoDB Atlas.[1][2]

## 1. Clonar el repositorio

Ejecuta el clon del repositorio desde la organización de GitHub y entra a la carpeta del proyecto:

```bash
git clone https://github.com/PCI-Project/PCI-Proyecto-Tesis.git
cd PCI-Proyecto-Tesis
```

Después de clonar, conviene verificar que se descargaron correctamente la estructura del proyecto y los archivos compartidos, incluyendo el archivo de ejemplo de variables de entorno que sí debe existir en el repositorio.[1]

## 2. Crear el archivo local de variables de entorno

El archivo real `server/.env` no debe venir en el repositorio porque contiene credenciales, mientras que `server/.env.example` sí debe compartirse para indicar qué variables necesita cada desarrollador.[1][3]

Crea tu archivo local a partir del ejemplo:

```bash
cp server/.env.example server/.env
```

Si trabajas en Windows PowerShell, puedes usar:

```powershell
Copy-Item server/.env.example server/.env
```

## 3. Completar las credenciales locales

Abre `server/.env` y reemplaza los valores de ejemplo por tus credenciales reales de desarrollo. Cada colaborador debe usar su propia URI local si se le creó un usuario independiente en MongoDB Atlas; varios usuarios pueden conectarse al mismo clúster usando distintas credenciales.[4][5][6]

Ejemplo:

```env
MONGODB_URI=mongodb+srv://tu_usuario:tu_password@tucluster.xxxxx.mongodb.net/pci_db?retryWrites=true&w=majority
PORT=5000
JWT_SECRET=tu_secreto_local
NODE_ENV=development
```

Si la contraseña contiene caracteres especiales como `@`, `:` o `/`, debe estar codificada correctamente dentro de la URI para evitar errores de conexión.[7][8]

## 4. Verificar acceso en MongoDB Atlas

Para conectarte correctamente al clúster, no basta con tener la URI; MongoDB Atlas también requiere que exista un usuario válido de base de datos y que tu IP esté permitida en la IP Access List del proyecto.[2][5][9]

Antes de continuar, confirma con el administrador del proyecto que:

- Existe un usuario de MongoDB Atlas asignado para ti.[5][6]
- Tu IP pública fue agregada en **Network Access**.[9][10]
- Tienes permisos al menos de `readWrite` sobre la base de datos de desarrollo, si ese es el nivel requerido por el proyecto.[5][6]

## 5. Instalar dependencias

Instala las dependencias del proyecto en la raíz y, si el backend tiene su propio `package.json`, también dentro de `server`.

```bash
npm install
cd server
npm install
cd ..
```

La estructura exacta puede variar según el repositorio, pero el objetivo es dejar listas las dependencias del frontend y del backend antes de ejecutar el sistema.

## 6. Ejecutar el backend

Una vez creado `server/.env`, inicia el backend desde la carpeta `server`:

```bash
cd server
npm run dev
```

Si el proyecto usa otro script, revisa `server/package.json` y ejecuta el script correspondiente. Si la conexión a Atlas está bien configurada, el servidor debería iniciar sin errores relacionados con autenticación o red.

## 7. Ejecutar el frontend

En otra terminal, vuelve a la raíz del proyecto y levanta el frontend:

```bash
npm run dev
```

A partir de ahí, el sistema debería consumir el backend local y trabajar con la base de datos configurada en tu archivo `server/.env`.[1]

## 8. Verificaciones rápidas si algo falla

Si el proyecto no conecta con MongoDB Atlas, revisa esto en este orden:

- El archivo `server/.env` existe realmente y no se llama por error `.env.txt`.
- La variable `MONGODB_URI` apunta al clúster correcto.[4][11]
- El usuario y contraseña de Atlas son correctos.[5]
- La IP del desarrollador está autorizada en Atlas.[9][10]
- La contraseña no tiene caracteres especiales sin codificar.[7][8]
- El backend está cargando `dotenv` correctamente.

## 9. Regla importante de seguridad

El archivo `server/.env` es local y no debe subirse al repositorio. La práctica correcta es compartir solo `server/.env.example` y mantener el archivo real fuera de Git mediante `.gitignore`.[1][3]

## 10. Flujo de trabajo básico después de configurar el entorno

Una vez que el proyecto ya corre en local, el flujo recomendado es:

```bash
git checkout main
git pull origin main
git checkout -b feature/nombre-de-tu-rama
```

Después de trabajar:

```bash
git add .
git commit -m "feat: descripcion del cambio"
git push origin feature/nombre-de-tu-rama
```

Luego se debe abrir un Pull Request en GitHub para revisión antes de fusionar a `main`, especialmente si el repositorio usa control por ramas y revisiones de código.[12][13]
