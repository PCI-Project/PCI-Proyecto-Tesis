# Instrucciones para colaboradores después de clonar el repositorio

## 1. Clonar repositorio
Clona el repositorio de la organización y entra a la carpeta del proyecto.

```bash
git clone https://github.com/PCI-Project/PCI-Proyecto-Tesis.git
cd PCI-Proyecto-Tesis
```

## 2. Creación del archivo local
Crea tu archivo local de entorno a partir del archivo de ejemplo. El archivo real `server/.env` no se sube al repositorio.

```bash
cp server/.env.example server/.env
```

## 3. Completar los credenciales
Abre `server/.env` y reemplaza los valores de ejemplo por tus credenciales reales. Cada colaborador debe usar su propia URI local de MongoDB Atlas.

```env
MONGODB_URI=mongodb+srv://tu_usuario:tu_password@tucluster.xxxxx.mongodb.net/pci_db?retryWrites=true&w=majority
PORT=5000
JWT_SECRET=tu_secreto_local
NODE_ENV=development
```

## 4. Verificación de accesos
Confirma que tu usuario fue creado en MongoDB Atlas y que tu IP pública fue agregada en **Network Access**. Sin esos dos puntos, la conexión al clúster fallará.

## 5. Instalación de dependencias
Instala las dependencias del proyecto en la raíz y en `server`, si aplica.

```bash
npm install
cd server
npm install
cd ..
```

## 6. Ejecución del backend
Inicia el backend desde la carpeta `server`.

```bash
cd server
npm run dev
```

## 7. Ejecución del frontend
Abre otra terminal, vuelve a la raíz del proyecto y ejecuta el frontend.

```bash
npm run dev
```

## 8. Verificación de si falla
Si algo falla, revisa en este orden: el archivo `server/.env`, la URI, el usuario y contraseña de Atlas, la IP autorizada y los caracteres especiales en la contraseña.

## 9. Flujo de trabajo después de la configuración
Antes de trabajar, actualiza `main`, crea tu rama y luego sube tus cambios en esa rama. Después abre un Pull Request para revisión.

```bash
git checkout main
git pull origin main
git checkout -b feature/nombre-de-tu-rama
```

Cuando termines:

```bash
git add .
git commit -m "feat: descripcion del cambio"
git push origin feature/nombre-de-tu-rama
```
Luego se debe abrir un Pull Request en GitHub para revisión antes de fusionar a `main`, especialmente si el repositorio usa control por ramas y revisiones de código.
