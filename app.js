// Función para limpiar etiquetas HTML, JS o PHP
function sanitizeInput(input) {
    if (!input) return '';
    // Elimina etiquetas HTML y PHP
    return input.replace(/<[^>]*>?/gm, '').replace(/<\?php.*?\?>/gs, '');
}
const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const multer = require("multer");
const upload = multer();
const app = express();

const con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "n0m3l0",
    database: "deseperanza"
});

con.connect((err) => {
    if (err) {
        console.error("Error al conectar a la base de datos:", err);
        process.exit(1);
    } else {
        console.log("Conexión exitosa a la base de datos panaderia");
    }
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Crear producto
app.post("/agregarProducto", upload.single("imagen"), (req, res) => {
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
    con.query(
        "INSERT INTO producto (nombre, descripcion, precio, stock, imagen) VALUES (?, ?, ?, ?, ?)",
        [nombre, descripcion, precio, stock, imagenBuffer],
        (err, result) => {
            if (err) {
                console.error("Error al agregar producto:", err);
                return res.status(500).json({ error: "Error al agregar producto." });
            }
            return res.json({ mensaje: "Producto agregado correctamente." });
        }
    );
});

// Leer productos
app.get("/obtenerProductos", (req, res) => {
    con.query("SELECT * FROM producto", (err, rows) => {
        if (err) {
            console.error("Error al obtener productos:", err);
            return res.status(500).json({ error: "Error al obtener productos." });
        }
        return res.json(rows);
    });
});

// Actualizar producto
app.post("/actualizarProducto", upload.single("imagen"), (req, res) => {
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
        sql = "UPDATE producto SET nombre=?, descripcion=?, precio=?, stock=?, imagen=? WHERE id_producto=?";
        params = [nombre, descripcion, precio, stock, imagenBuffer, id_producto];
    } else {
        sql = "UPDATE producto SET nombre=?, descripcion=?, precio=?, stock=? WHERE id_producto=?";
        params = [nombre, descripcion, precio, stock, id_producto];
    }
    con.query(
        sql,
        params,
        (err, result) => {
            if (err) {
                console.error("Error al actualizar producto:", err);
                return res.status(500).json({ error: "Error al actualizar producto." });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Producto no encontrado." });
            }
            return res.json({ mensaje: "Producto actualizado correctamente." });
        }
    );
});
// Endpoint para servir la imagen desde la base de datos
app.get("/imagen/:id_producto", (req, res) => {
    const { id_producto } = req.params;
    con.query("SELECT imagen FROM producto WHERE id_producto = ?", [id_producto], (err, results) => {
        if (err || results.length === 0 || !results[0].imagen) {
            return res.status(404).send("Imagen no encontrada");
        }
        res.set("Content-Type", "image/jpeg"); // Ajusta si usas otro formato
        res.send(results[0].imagen);
    });
});

// Eliminar producto
app.post("/borrarProducto", (req, res) => {
    const { id_producto } = req.body;
    if (!id_producto) {
        return res.status(400).json({ error: "ID de producto es obligatorio." });
    }
    con.query(
        "DELETE FROM producto WHERE id_producto=?",
        [id_producto],
        (err, result) => {
            if (err) {
                console.error("Error al borrar producto:", err);
                return res.status(500).json({ error: "Error al borrar producto." });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Producto no encontrado." });
            }
            return res.json({ mensaje: "Producto borrado correctamente." });
        }
    );
});

app.listen(10000, () => {
    console.log("Servidor escuchando en el puerto 10000");
});