// Función para limpiar etiquetas HTML, JS o PHP
function sanitizeInput(input) {
    if (!input) return '';
    // Elimina etiquetas HTML y PHP
    return input.replace(/<[^>]*>?/gm, '').replace(/<\?php.*?\?>/gs, '');
}

const express = require("express");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const multer = require("multer");
const upload = multer();
const app = express();

// Configuración de PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://root:n0m3l0@localhost:5432/deseperanza",
    ssl: process.env.DATABASE_URL ? {
        rejectUnauthorized: false
    } : false
});

// Verificar conexión
pool.connect((err, client, release) => {
    if (err) {
        console.error("Error al conectar a la base de datos:", err);
        process.exit(1);
    } else {
        console.log("Conexión exitosa a la base de datos");
        release();
    }
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Endpoint para crear la tabla (EJECUTAR UNA SOLA VEZ)
app.get("/setup", async (req, res) => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS producto (
                id_producto SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                descripcion TEXT,
                precio DECIMAL(10, 2) NOT NULL,
                stock INTEGER NOT NULL DEFAULT 0,
                imagen BYTEA
            );
        `);
        res.json({ mensaje: "✓ Tabla producto creada correctamente" });
    } catch (err) {
        console.error("Error al crear tabla:", err);
        res.status(500).json({ error: err.message });
    }
});

// Crear producto
app.post("/agregarProducto", upload.single("imagen"), async (req, res) => {
    let { nombre, descripcion, precio, stock } = req.body;
    let imagenBuffer = null;
    if (req.file) {
        imagenBuffer = req.file.buffer;
    }
    // Sanitizar entradas
    nombre = sanitizeInput(nombre);
    descripcion = sanitizeInput(descripcion);
    if (!nombre || !precio || !stock) {
        return res.status(400).json({ error: "Nombre, precio y stock son obligatorios." });
    }
    if (isNaN(precio) || precio <= 0 || isNaN(stock) || stock < 0) {
        return res.status(400).json({ error: "Precio y stock deben ser valores válidos." });
    }
    
    try {
        await pool.query(
            "INSERT INTO producto (nombre, descripcion, precio, stock, imagen) VALUES ($1, $2, $3, $4, $5)",
            [nombre, descripcion, precio, stock, imagenBuffer]
        );
        return res.json({ mensaje: "Producto agregado correctamente." });
    } catch (err) {
        console.error("Error al agregar producto:", err);
        return res.status(500).json({ error: "Error al agregar producto." });
    }
});

// Leer productos
app.get("/obtenerProductos", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM producto");
        return res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener productos:", err);
        return res.status(500).json({ error: "Error al obtener productos." });
    }
});

// Actualizar producto
app.post("/actualizarProducto", upload.single("imagen"), async (req, res) => {
    let { id_producto, nombre, descripcion, precio, stock } = req.body;
    let imagenBuffer = null;
    if (req.file) {
        imagenBuffer = req.file.buffer;
    }
    // Sanitizar entradas
    nombre = sanitizeInput(nombre);
    descripcion = sanitizeInput(descripcion);
    if (!id_producto || !nombre || !precio || !stock) {
        return res.status(400).json({ error: "ID, nombre, precio y stock son obligatorios." });
    }
    if (isNaN(precio) || precio <= 0 || isNaN(stock) || stock < 0) {
        return res.status(400).json({ error: "Precio y stock deben ser valores válidos." });
    }
    
    let sql, params;
    if (imagenBuffer) {
        sql = "UPDATE producto SET nombre=$1, descripcion=$2, precio=$3, stock=$4, imagen=$5 WHERE id_producto=$6";
        params = [nombre, descripcion, precio, stock, imagenBuffer, id_producto];
    } else {
        sql = "UPDATE producto SET nombre=$1, descripcion=$2, precio=$3, stock=$4 WHERE id_producto=$5";
        params = [nombre, descripcion, precio, stock, id_producto];
    }
    
    try {
        const result = await pool.query(sql, params);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Producto no encontrado." });
        }
        return res.json({ mensaje: "Producto actualizado correctamente." });
    } catch (err) {
        console.error("Error al actualizar producto:", err);
        return res.status(500).json({ error: "Error al actualizar producto." });
    }
});

// Endpoint para servir la imagen desde la base de datos
app.get("/imagen/:id_producto", async (req, res) => {
    const { id_producto } = req.params;
    try {
        const result = await pool.query("SELECT imagen FROM producto WHERE id_producto = $1", [id_producto]);
        if (result.rows.length === 0 || !result.rows[0].imagen) {
            return res.status(404).send("Imagen no encontrada");
        }
        res.set("Content-Type", "image/jpeg");
        res.send(result.rows[0].imagen);
    } catch (err) {
        console.error("Error al obtener imagen:", err);
        return res.status(500).send("Error al obtener imagen");
    }
});

// Eliminar producto
app.post("/borrarProducto", async (req, res) => {
    const { id_producto } = req.body;
    if (!id_producto) {
        return res.status(400).json({ error: "ID de producto es obligatorio." });
    }
    
    try {
        const result = await pool.query(
            "DELETE FROM producto WHERE id_producto=$1",
            [id_producto]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Producto no encontrado." });
        }
        return res.json({ mensaje: "Producto borrado correctamente." });
    } catch (err) {
        console.error("Error al borrar producto:", err);
        return res.status(500).json({ error: "Error al borrar producto." });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});