// app.js
// Servidor Express con autenticación por sesión, manejo de productos y carrito

const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const multer = require("multer");
const upload = multer();
const bcrypt = require("bcrypt");
const session = require("express-session");

const app = express();

// --- Sanitizador simple ---
function sanitizeInput(input) {
    if (!input) return '';
    return String(input).replace(/<[^>]*>?/gm, '').replace(/<\?php.*?\?>/gs, '');
}

// --- Conexión MySQL ---
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

// --- Middlewares ---
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({
    secret: "cambiar_esto_a_algo_seguro", // en producción usar variable de entorno
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 día
}));

// --- Rutas de autenticación ---

// Registro
app.post("/register", async (req, res) => {
    let { nombre, email, password, rol } = req.body;
    nombre = sanitizeInput(nombre);
    email = sanitizeInput(email);
    rol = rol === 'admin' ? 'admin' : 'cliente';

    if (!nombre || !email || !password) {
        return res.status(400).json({ error: "Todos los campos son obligatorios." });
    }
    try {
        const [rows] = await con.promise().query("SELECT id_usuario FROM usuario WHERE email = ?", [email]);
        if (rows.length > 0) return res.status(400).json({ error: "Email ya registrado." });

        const hashed = await bcrypt.hash(password, 10);
        const [result] = await con.promise().query(
            "INSERT INTO usuario (nombre, email, password, rol) VALUES (?, ?, ?, ?)",
            [nombre, email, hashed, rol]
        );
        req.session.user = { id_usuario: result.insertId, nombre, email, rol };
        return res.json({ mensaje: "Registrado correctamente.", user: req.session.user });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error en el registro." });
    }
});

// Login
app.post("/login", async (req, res) => {
    let { email, password } = req.body;
    email = sanitizeInput(email);
    if (!email || !password) return res.status(400).json({ error: "Email y contraseña son obligatorios." });

    try {
        const [rows] = await con.promise().query("SELECT id_usuario, nombre, email, password, rol FROM usuario WHERE email = ?", [email]);
        if (rows.length === 0) return res.status(400).json({ error: "Credenciales inválidas." });
        const user = rows[0];
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(400).json({ error: "Credenciales inválidas." });

        req.session.user = {
            id_usuario: user.id_usuario,
            nombre: user.nombre,
            email: user.email,
            rol: user.rol
        };
        return res.json({ mensaje: "Login correcto.", user: req.session.user });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error en el login." });
    }
});

// Logout
app.post("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: "Error al cerrar sesión." });
        res.clearCookie('connect.sid');
        return res.json({ mensaje: "Cerraste sesión." });
    });
});

// Obtener usuario actual (si está autenticado)
app.get("/me", (req, res) => {
    if (!req.session.user) return res.json({ user: null });
    return res.json({ user: req.session.user });
});

// --- Endpoints productos (tus endpoints existentes adaptados) ---

// Crear producto (admin)
app.post("/agregarProducto", upload.single("imagen"), (req, res) => {
    if (!req.session.user || req.session.user.rol !== 'admin') {
        return res.status(403).json({ error: "Acceso denegado." });
    }
    let { nombre, descripcion, precio, stock } = req.body;
    let imagenBuffer = null;
    if (req.file) imagenBuffer = req.file.buffer;

    nombre = sanitizeInput(nombre);
    descripcion = sanitizeInput(descripcion);
    if (!nombre || !precio || !stock) {
        return res.status(400).json({ error: "Nombre, precio y stock son obligatorios." });
    }
    precio = Number(precio);
    stock = Number(stock);
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

// Leer productos (para todos)
app.get("/obtenerProductos", (req, res) => {
    con.query("SELECT id_producto, nombre, descripcion, precio, stock, imagen IS NOT NULL as tieneImagen FROM producto", (err, rows) => {
        if (err) {
            console.error("Error al obtener productos:", err);
            return res.status(500).json({ error: "Error al obtener productos." });
        }
        return res.json(rows);
    });
});

// Actualizar producto (admin)
app.post("/actualizarProducto", upload.single("imagen"), (req, res) => {
    if (!req.session.user || req.session.user.rol !== 'admin') {
        return res.status(403).json({ error: "Acceso denegado." });
    }
    let { id_producto, nombre, descripcion, precio, stock } = req.body;
    let imagenBuffer = null;
    if (req.file) imagenBuffer = req.file.buffer;

    nombre = sanitizeInput(nombre);
    descripcion = sanitizeInput(descripcion);
    if (!id_producto || !nombre || !precio || !stock) {
        return res.status(400).json({ error: "ID, nombre, precio y stock son obligatorios." });
    }
    precio = Number(precio);
    stock = Number(stock);
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
    con.query(sql, params, (err, result) => {
        if (err) {
            console.error("Error al actualizar producto:", err);
            return res.status(500).json({ error: "Error al actualizar producto." });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Producto no encontrado." });
        }
        return res.json({ mensaje: "Producto actualizado correctamente." });
    });
});

// Servir imagen
app.get("/imagen/:id_producto", (req, res) => {
    const { id_producto } = req.params;
    con.query("SELECT imagen FROM producto WHERE id_producto = ?", [id_producto], (err, results) => {
        if (err || results.length === 0 || !results[0].imagen) {
            return res.status(404).send("Imagen no encontrada");
        }
        res.set("Content-Type", "image/jpeg");
        res.send(results[0].imagen);
    });
});

// Borrar producto (admin)
app.post("/borrarProducto", (req, res) => {
    if (!req.session.user || req.session.user.rol !== 'admin') {
        return res.status(403).json({ error: "Acceso denegado." });
    }
    const { id_producto } = req.body;
    if (!id_producto) {
        return res.status(400).json({ error: "ID de producto es obligatorio." });
    }
    con.query("DELETE FROM producto WHERE id_producto=?", [id_producto], (err, result) => {
        if (err) {
            console.error("Error al borrar producto:", err);
            return res.status(500).json({ error: "Error al borrar producto." });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Producto no encontrado." });
        }
        return res.json({ mensaje: "Producto borrado correctamente." });
    });
});

// --- Endpoints carrito ---

// Agregar al carrito (cliente)
app.post("/carrito/agregar", async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "No autenticado." });
    const id_usuario = req.session.user.id_usuario;
    const { id_producto, cantidad } = req.body;
    if (!id_producto || !cantidad) return res.status(400).json({ error: "Producto y cantidad obligatorios." });

    // verificar stock
    try {
        const [p] = await con.promise().query("SELECT stock FROM producto WHERE id_producto = ?", [id_producto]);
        if (p.length === 0) return res.status(404).json({ error: "Producto no encontrado." });
        if (p[0].stock < cantidad) return res.status(400).json({ error: "No hay suficiente stock." });

        // si ya existe el producto en el carrito, sumar cantidad
        const [exists] = await con.promise().query("SELECT id_carrito, cantidad FROM carrito WHERE id_usuario = ? AND id_producto = ?", [id_usuario, id_producto]);
        if (exists.length > 0) {
            const nueva = exists[0].cantidad + Number(cantidad);
            await con.promise().query("UPDATE carrito SET cantidad = ? WHERE id_carrito = ?", [nueva, exists[0].id_carrito]);
        } else {
            await con.promise().query("INSERT INTO carrito (id_usuario, id_producto, cantidad) VALUES (?, ?, ?)", [id_usuario, id_producto, cantidad]);
        }
        return res.json({ mensaje: "Agregado al carrito." });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al agregar al carrito." });
    }
});

// Obtener carrito del usuario
app.get("/carrito", async (req, res) => {
    if (!req.session.user) return res.json({ items: [] });
    const id_usuario = req.session.user.id_usuario;
    try {
        const [rows] = await con.promise().query(
            `SELECT c.id_carrito, c.cantidad, p.id_producto, p.nombre, p.precio 
            FROM carrito c JOIN producto p ON c.id_producto = p.id_producto WHERE c.id_usuario = ?`,
            [id_usuario]
        );
        return res.json({ items: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al obtener carrito." });
    }
});

// Actualizar cantidad en carrito
app.post("/carrito/actualizar", async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "No autenticado." });
    const { id_carrito, cantidad } = req.body;
    if (!id_carrito || cantidad == null) return res.status(400).json({ error: "Datos incompletos." });

    try {
        // verificar stock del producto
        const [rows] = await con.promise().query("SELECT id_producto FROM carrito WHERE id_carrito = ?", [id_carrito]);
        if (rows.length === 0) return res.status(404).json({ error: "Item no encontrado." });
        const id_producto = rows[0].id_producto;
        const [p] = await con.promise().query("SELECT stock FROM producto WHERE id_producto = ?", [id_producto]);
        if (p.length === 0) return res.status(404).json({ error: "Producto no encontrado." });
        if (p[0].stock < cantidad) return res.status(400).json({ error: "No hay suficiente stock." });

        await con.promise().query("UPDATE carrito SET cantidad = ? WHERE id_carrito = ?", [cantidad, id_carrito]);
        return res.json({ mensaje: "Cantidad actualizada." });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al actualizar carrito." });
    }
});

// Eliminar item del carrito
app.post("/carrito/eliminar", async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "No autenticado." });
    const { id_carrito } = req.body;
    if (!id_carrito) return res.status(400).json({ error: "ID de carrito obligatorio." });
    try {
        await con.promise().query("DELETE FROM carrito WHERE id_carrito = ?", [id_carrito]);
        return res.json({ mensaje: "Item eliminado." });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al eliminar item." });
    }
});

// Checkout: descontar stock y vaciar carrito del usuario (transacción simple)
// Checkout: descontar stock, guardar venta y vaciar carrito
app.post("/carrito/checkout", async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "No autenticado." });
    const id_usuario = req.session.user.id_usuario;
    const connection = con.promise();

    try {
        await connection.query("START TRANSACTION");

        // Obtener carrito con bloqueo
        const [items] = await connection.query(
            `SELECT c.id_carrito, c.cantidad, p.id_producto, p.stock, p.precio 
            FROM carrito c JOIN producto p ON c.id_producto = p.id_producto WHERE c.id_usuario = ? FOR UPDATE`,
            [id_usuario]
        );

        if (items.length === 0) {
            await connection.query("ROLLBACK");
            return res.status(400).json({ error: "Carrito vacío." });
        }

        // Verificar stock
        for (const it of items) {
            if (it.stock < it.cantidad) {
                await connection.query("ROLLBACK");
                return res.status(400).json({ error: `No hay suficiente stock para ${it.id_producto}.` });
            }
        }

        // Crear venta
        const [venta] = await connection.query("INSERT INTO venta (id_usuario) VALUES (?)", [id_usuario]);
        const id_venta = venta.insertId;

        // Insertar detalle y actualizar stock
        for (const it of items) {
            await connection.query(
                "INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio) VALUES (?, ?, ?, ?)",
                [id_venta, it.id_producto, it.cantidad, it.precio]
            );
            await connection.query(
                "UPDATE producto SET stock = stock - ? WHERE id_producto = ?",
                [it.cantidad, it.id_producto]
            );
        }

        // Vaciar carrito
        await connection.query("DELETE FROM carrito WHERE id_usuario = ?", [id_usuario]);

        await connection.query("COMMIT");
        return res.json({ mensaje: "Compra realizada con éxito." });

    } catch (err) {
        console.error(err);
        try { await connection.query("ROLLBACK"); } catch(e){}
        return res.status(500).json({ error: "Error en checkout." });
    }
});

// Obtener ventas totales por producto (solo admin)
app.get("/ventas", async (req, res) => {
    if (!req.session.user || req.session.user.rol !== 'admin') {
        return res.status(403).json({ error: "Acceso denegado." });
    }
    try {
        const [rows] = await con.promise().query(
            `SELECT p.id_producto, p.nombre, SUM(d.cantidad) as total_vendido, SUM(d.cantidad * d.precio) as total_ingresos
            FROM detalle_venta d
            JOIN producto p ON d.id_producto = p.id_producto
            GROUP BY p.id_producto, p.nombre
            ORDER BY total_vendido DESC`
        );
        return res.json(rows);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al obtener ventas." });
    }
});

app.get("/usuarios", async (req, res) => {
    if (!req.session.user || req.session.user.rol !== 'admin') {
        return res.status(403).json({ error: "Acceso denegado." });
    }
    try {
        const [rows] = await con.promise().query("SELECT id_usuario, nombre, email, rol FROM usuario");
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al obtener usuarios." });
    }
});

app.post("/usuarios/agregar", async (req, res) => {
    if (!req.session.user || req.session.user.rol !== 'admin') {
        return res.status(403).json({ error: "Acceso denegado." });
    }
    let { nombre, email, rol } = req.body;
    nombre = sanitizeInput(nombre);
    email = sanitizeInput(email);
    rol = rol === "admin" ? "admin" : "cliente";

    try {
        // validar que no exista email
        const [rows] = await con.promise().query("SELECT id_usuario FROM usuario WHERE email=?", [email]);
        if (rows.length > 0) {
            return res.status(400).json({ error: "Email ya registrado." });
        }

        // contraseña por defecto
        const defaultPassword = "123456";
        const hashed = await bcrypt.hash(defaultPassword, 10);

        await con.promise().query(
            "INSERT INTO usuario (nombre, email, password, rol) VALUES (?, ?, ?, ?)",
            [nombre, email, hashed, rol]
        );

        res.json({ 
            mensaje: "Usuario agregado correctamente.", 
            passwordTemporal: defaultPassword 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al agregar usuario." });
    }
});


app.post("/usuarios/eliminar", async (req, res) => {
    if (!req.session.user || req.session.user.rol !== 'admin') {
        return res.status(403).json({ error: "Acceso denegado." });
    }
    const { id } = req.body;
    try {
        await con.promise().query("DELETE FROM usuario WHERE id_usuario=?", [id]);
        res.json({ mensaje: "Usuario eliminado." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al eliminar usuario." });
    }
});

// Restablecer contraseña
app.post("/resetPassword", async (req, res) => {
    let { nombre, email, newPassword } = req.body;
    nombre = sanitizeInput(nombre);
    email = sanitizeInput(email);

    if (!nombre || !email || !newPassword) {
        return res.status(400).json({ error: "Todos los campos son obligatorios." });
    }

    try {
        const [rows] = await con.promise().query(
            "SELECT id_usuario FROM usuario WHERE nombre = ? AND email = ?",
            [nombre, email]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: "No se encontró usuario con esos datos." });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await con.promise().query(
            "UPDATE usuario SET password = ? WHERE id_usuario = ?",
            [hashed, rows[0].id_usuario]
        );

        return res.json({ mensaje: "Contraseña actualizada correctamente." });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al restablecer contraseña." });
    }
});


// --- Puerto ---
app.listen(10000, () => {
    console.log("Servidor escuchando en el puerto 10000");
});
