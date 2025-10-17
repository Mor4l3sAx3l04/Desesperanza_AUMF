// script.js - Frontend con auth, carrito y rol-based UI

document.addEventListener('DOMContentLoaded', () => {

  // elementos auth
  window.formRegister = document.getElementById('formRegister');
  window.formLogin = document.getElementById('formLogin');
  window.authOverlay = document.getElementById('authOverlay');
  window.mainApp = document.getElementById('mainApp');
  window.btnAgregarPan = document.getElementById('btnAgregarPan');
  window.btnCarrito = document.getElementById('btnCarrito');
  window.badgeCarrito = document.getElementById('badgeCarrito');
  window.btnPerfil = document.getElementById('btnPerfil');
  window.logoutBtn = document.getElementById('logoutBtn');

  // switch login/register
  document.getElementById('switchToLogin').addEventListener('click', (e) => {
    e.preventDefault();
    showLogin();
  });
  document.getElementById('switchToRegister').addEventListener('click', (e) => {
    e.preventDefault();
    showRegister();
  });

  formRegister.addEventListener('submit', handleRegister);
  formLogin.addEventListener('submit', handleLogin);
  logoutBtn.addEventListener('click', handleLogout);

  btnCarrito.addEventListener('click', () => {
    new bootstrap.Modal(document.getElementById('modalCarrito')).show();
    cargarCarrito();
  });

  // Form producto
    document.getElementById('formProducto').addEventListener('submit', guardarProducto);
    document.getElementById('modalProducto').addEventListener('hidden.bs.modal', () => {
    document.getElementById('formProducto').reset();
    document.getElementById('id_producto').value = '';
    document.getElementById('mensajeError').classList.add('d-none');
  });

  // Inicializar estado: si ya hay sesión, entrar
  fetch('/me').then(r => r.json()).then(data => {
    if (data.user) {
      onLogin(data.user); // 👈 esto ya llama a cargarProductos()
    } else {
      showRegister();
      // Si quieres que el cliente también vea productos antes de loguearse:
      cargarProductos();
    }
    cargarGaleria();
    actualizarBadge();
  });
  document.getElementById('btnLogin').addEventListener('click', login);
  document.getElementById('btnRegistrar').addEventListener('click', registrar);
  document.getElementById('btnLogout').addEventListener('click', logout);
  document.getElementById('btnAgregarPan').addEventListener('click', abrirModal);
  document.getElementById('guardarProducto').addEventListener('click', guardarProducto);
  document.getElementById('btnCheckout').addEventListener('click', checkout);
});

// ---------- Auth ----------
function showLogin() {
  document.getElementById('authTitle').textContent = 'Iniciar sesión';
  document.getElementById('formRegister').classList.add('d-none');
  document.getElementById('formLogin').classList.remove('d-none');
  document.getElementById('authError').classList.add('d-none');
  document.getElementById('loginError').classList.add('d-none');
}
function showRegister() {
  document.getElementById('authTitle').textContent = 'Crear cuenta';
  document.getElementById('formRegister').classList.remove('d-none');
  document.getElementById('formLogin').classList.add('d-none');
}

async function handleRegister(e) {
  e.preventDefault();
  const nombre = document.getElementById('regNombre').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const rol = document.getElementById('isAdmin').checked ? 'admin' : 'cliente';

  const resp = await fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, email, password, rol })
  }).then(r => r.json());

  if (resp.error) {
    const el = document.getElementById('authError');
    el.textContent = resp.error;
    el.classList.remove('d-none');
    return;
  }
  onLogin(resp.user);
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('logEmail').value.trim();
  const password = document.getElementById('logPassword').value;

  const resp = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  }).then(r => r.json());

  if (resp.error) {
    const el = document.getElementById('loginError');
    el.textContent = resp.error;
    el.classList.remove('d-none');
    return;
  }
  onLogin(resp.user);
}

async function handleLogout(e) {
  e.preventDefault();
  await fetch('/logout', { method: 'POST' }).then(r => r.json());
  // volver a inicio
  document.getElementById('authOverlay').classList.remove('d-none');
  document.getElementById('mainApp').style.display = 'none';
  showRegister();
  actualizarBadge();
}

// ---------- Estado post-login ----------
let currentUser = null;
function onLogin(user) {
  currentUser = user;
  document.getElementById('authOverlay').classList.add('d-none');
  document.getElementById('mainApp').style.display = 'block';

  if (user.rol === 'admin') {
    document.getElementById('btnAgregarPan').style.display = 'inline-block';
  } else {
    document.getElementById('btnAgregarPan').style.display = 'none';
  }

  actualizarPerfilDropdown();
  actualizarBadge();

  // 👇 Ahora que ya sabemos el rol, cargamos los productos
  cargarProductos();
}

// mostrar opciones en dropdown segun rol
function actualizarPerfilDropdown() {
  const menu = document.getElementById('perfilDropdown');
  menu.innerHTML = '';
  const liNombre = document.createElement('li');
  liNombre.innerHTML = `<h6 class="dropdown-header">${escapeHtml(currentUser.nombre)}</h6>`;
  menu.appendChild(liNombre);
  if (currentUser.rol === 'admin') {
    const liAdmin = document.createElement('li');
    liAdmin.innerHTML = `<a class="dropdown-item" href="#" id="adminPanel">Panel admin</a>`;
    menu.appendChild(liAdmin);
    // admin panel can open product modal for add
    setTimeout(() => {
      const btn = document.getElementById('adminPanel');
      if (btn) btn.addEventListener('click', (e) => {
        e.preventDefault();
        new bootstrap.Modal(document.getElementById('modalProducto')).show();
      });
    }, 10);
  }
  const liLogout = document.createElement('li');
  liLogout.innerHTML = `<hr class="dropdown-divider"><a class="dropdown-item" href="#" id="logoutBtn2">Cerrar sesión</a>`;
  menu.appendChild(liLogout);
  setTimeout(() => {
    const l = document.getElementById('logoutBtn2');
    if (l) l.addEventListener('click', handleLogout);
  }, 10);
}

// ---------- Productos (adaptado de tu versión) ----------
function cargarProductos() {
  fetch('/obtenerProductos')
    .then(res => res.json())
    .then(productos => {
      const tbody = document.querySelector('#tablaProductos tbody');
      tbody.innerHTML = '';
      productos.forEach((prod, idx) => {
        const imgSrc = prod.tieneImagen
        ? `/imagen/${prod.id_producto}`
        : 'https://via.placeholder.com/150?text=Sin+Imagen';

        // acciones: si admin -> editar/borrar; si cliente -> agregar al carrito
        let acciones = '';
        if (currentUser && currentUser.rol === 'admin') {
          acciones = `
            <button class="btn btn-sm btn-warning me-1 btn-editar" data-prod='${JSON.stringify(prod).replace(/'/g, "&#39;")}' type="button">Editar</button>
            <button class="btn btn-sm btn-danger" onclick="borrarProducto(${prod.id_producto})">Borrar</button>
          `;
        } else {
          acciones = `<button class="btn btn-sm btn-primary" onclick="agregarAlCarrito(${prod.id_producto})" ${prod.stock<=0? 'disabled':''}>Agregar al carrito</button>`;
        }
        tbody.innerHTML += `
          <tr>
            <td>${idx + 1}</td>
            <td><img src="${imgSrc}" alt="pan" class="img-thumbnail" style="width:60px;height:60px;object-fit:cover;"></td>
            <td>${escapeHtml(prod.nombre)}</td>
            <td>${escapeHtml(prod.descripcion || '')}</td>
            <td>$${Number(prod.precio).toFixed(2)}</td>
            <td>${prod.stock}</td>
            <td>${acciones}</td>
          </tr>
        `;
      });
      // Asignar eventos a los botones editar
      document.querySelectorAll('.btn-editar').forEach(btn => {
        btn.addEventListener('click', function() {
          editarProducto(this.getAttribute('data-prod'));
        });
      });
    });
}

// guardar/actualizar producto (admin)
function guardarProducto(e) {
  e.preventDefault();
  const form = e.target;
  const id = form.id_producto.value;
  const nombre = form.nombre.value.trim();
  const descripcion = form.descripcion.value.trim();
  const precio = form.precio.value;
  const stock = form.stock.value;
  const imagenInput = form.imagen;
  const mensajeError = document.getElementById('mensajeError');
  mensajeError.classList.add('d-none');

  if (!nombre || !precio || !stock || precio <= 0 || stock < 0) {
    mensajeError.textContent = 'Todos los campos obligatorios deben ser válidos.';
    mensajeError.classList.remove('d-none');
    return;
  }
  const etiquetaRegex = /<[^>]*>|<\?php.*?\?>/i;
  const numeroRegex = /\d/;
  if (etiquetaRegex.test(nombre) || etiquetaRegex.test(descripcion)) {
    mensajeError.textContent = 'No se permiten etiquetas HTML, JS o PHP en el nombre o la descripción.';
    mensajeError.classList.remove('d-none');
    return;
  }
  if (numeroRegex.test(nombre) || numeroRegex.test(descripcion)) {
    mensajeError.textContent = 'No se permiten números en el nombre o la descripción.';
    mensajeError.classList.remove('d-none');
    return;
  }

  const formData = new FormData();
  formData.append('nombre', nombre);
  formData.append('descripcion', descripcion);
  formData.append('precio', precio);
  formData.append('stock', stock);
  if (imagenInput.files && imagenInput.files[0]) {
    formData.append('imagen', imagenInput.files[0]);
  }
  let url = '/agregarProducto';
  if (id) {
    formData.append('id_producto', id);
    url = '/actualizarProducto';
  }

  fetch(url, { method: 'POST', body: formData })
    .then(res => res.json())
    .then(resp => {
      if (resp.error) {
        mensajeError.textContent = resp.error;
        mensajeError.classList.remove('d-none');
      } else {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalProducto')).hide();
        form.reset();
        cargarProductos();
      }
    });
}

function editarProducto(prodStr) {
  let prod;
  try { prod = JSON.parse(prodStr); } catch { prod = JSON.parse(decodeURIComponent(prodStr)); }
  document.getElementById('id_producto').value = prod.id_producto;
  document.getElementById('nombre').value = prod.nombre;
  document.getElementById('descripcion').value = prod.descripcion || '';
  document.getElementById('precio').value = prod.precio;
  document.getElementById('stock').value = prod.stock;
  document.getElementById('imagen').value = '';
  document.getElementById('mensajeError').classList.add('d-none');
  const modal = new bootstrap.Modal(document.getElementById('modalProducto'));
  modal.show();
}

function borrarProducto(id) {
  if (!confirm('¿Seguro que deseas borrar este pan?')) return;
  fetch('/borrarProducto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_producto: id })
  }).then(r => r.json()).then(resp => {
    if (resp.error) alert(resp.error); else cargarProductos();
  });
}

// ---------- Galería (simple estática, editable por admin manualmente desde DB en esta versión) ----------
function cargarGaleria() {
  // Mantengo tu galería por defecto (puedes hacer endpoint para editar)
  const panes = [
    { nombre: 'Pan de Muerto', descripcion: 'Tradicional pan mexicano decorado con "huesitos" de masa y azúcar.', precio: 25, img: 'https://www.aceitesdeolivadeespana.com/wp-content/uploads/2016/06/pan_de_muerto.jpg' },
    { nombre: 'Calaverita de Azúcar', descripcion: 'Dulce típico de Día de Muertos hecho de azúcar y decorado a mano.', precio: 15, img: 'https://laroussecocina.mx/wp-content/uploads/2018/01/Calavera-de-azucar-001-Larousse-Cocina.jpg.webp' },
    { nombre: 'Pan de Calabaza', descripcion: 'Pan suave y esponjoso hecho con puré de calabaza y especias.', precio: 30, img: 'https://www.cuerpomente.com/medio/2023/10/16/pan-calabaza_a1d50000_231016124817_1280x720.jpg' },
    { nombre: 'Pan Fantasma', descripcion: 'Pan decorado con forma de fantasma, ideal para Halloween.', precio: 18, img: 'https://www.amr.org.mx/paneles/images/1/1-2-20231007191426-1.jpg' }
  ];
  const galeria = document.getElementById('galeria');
  galeria.innerHTML = panes.map(pan => `
    <div class="col-6 col-md-3">
      <div class="card shadow-sm h-100">
        <img src="${pan.img}" class="card-img-top" alt="${pan.nombre}" style="object-fit:cover;height:180px;">
        <div class="card-body text-center">
          <h6 class="card-title mb-1">${pan.nombre}</h6>
          <p class="card-text small mb-1">${pan.descripcion}</p>
          <span class="badge bg-warning text-dark">$${pan.precio}.00</span>
        </div>
      </div>
    </div>
  `).join('');
}

// ---------- Carrito (frontend) ----------
async function agregarAlCarrito(id_producto) {
  if (!currentUser) return alert('Debes iniciar sesión para agregar al carrito.');
  const cantidad = 1;
  const resp = await fetch('/carrito/agregar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_producto, cantidad })
  }).then(r => r.json());
  if (resp.error) return alert(resp.error);
  actualizarBadge();
  alert('Agregado al carrito.');
}

async function cargarCarrito() {
  const resp = await fetch('/carrito').then(r => r.json());
  const items = resp.items || [];
  const container = document.getElementById('carritoItems');
  if (items.length === 0) {
    container.innerHTML = '<p>Tu carrito está vacío.</p>';
    document.getElementById('carritoTotal').textContent = '0.00';
    return;
  }
  container.innerHTML = items.map(it => `
    <div class="d-flex align-items-center justify-content-between border-bottom py-2">
      <div>
        <strong>${escapeHtml(it.nombre)}</strong><br>
        Precio unitario: $${Number(it.precio).toFixed(2)}
      </div>
      <div class="d-flex align-items-center gap-2">
        <input data-id="${it.id_carrito}" class="form-control form-control-sm qty-input" type="number" min="1" style="width:80px;" value="${it.cantidad}">
        <button class="btn btn-sm btn-danger btn-eliminar" data-id="${it.id_carrito}">Eliminar</button>
      </div>
    </div>
  `).join('');
  // asignar eventos
  document.querySelectorAll('.qty-input').forEach(input => {
    input.addEventListener('change', async function() {
      const id = this.dataset.id;
      const cantidad = Number(this.value);
      if (cantidad <= 0) { this.value = 1; return; }
      const r = await fetch('/carrito/actualizar', {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id_carrito: id, cantidad })
      }).then(r => r.json());
      if (r.error) alert(r.error);
      cargarCarrito();
      actualizarBadge();
    });
  });
  document.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', async function() {
      const id = this.dataset.id;
      await fetch('/carrito/eliminar', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id_carrito: id }) }).then(r => r.json());
      cargarCarrito();
      actualizarBadge();
    });
  });

  const total = items.reduce((s, it) => s + (Number(it.precio) * Number(it.cantidad)), 0);
  document.getElementById('carritoTotal').textContent = total.toFixed(2);
}

// badge
async function actualizarBadge() {
  const resp = await fetch('/carrito').then(r => r.json());
  const count = (resp.items || []).reduce((s, it) => s + Number(it.cantidad), 0);
  badgeCarrito.textContent = count;
  badgeCarrito.style.display = count > 0 ? 'inline-block' : 'none';
}

// checkout
document.getElementById('btnCheckout').addEventListener('click', async () => {
  const r = await fetch('/carrito/checkout', { method: 'POST' }).then(r => r.json());
  if (r.error) return alert(r.error);
  alert(r.mensaje || 'Compra exitosa');
  cargarProductos();
  cargarCarrito();
  actualizarBadge();
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCarrito')).hide();
});

// script.js
document.addEventListener("DOMContentLoaded", () => {
  const formRegister = document.getElementById("formRegister");
  const authError = document.getElementById("authError");

  if (formRegister) {
    formRegister.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nombre = document.getElementById("regNombre").value.trim();
      const email = document.getElementById("regEmail").value.trim();
      const password = document.getElementById("regPassword").value.trim();
      const rol = document.getElementById("rolInput").value;

      if (!nombre || !email || !password) {
        mostrarError("Todos los campos son obligatorios.");
        return;
      }

      try {
        const res = await fetch("/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, email, password, rol }),
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Error al registrar.");

        alert("✅ Registro exitoso. ¡Bienvenido!");
        authError.classList.add("d-none");

        console.log("Usuario registrado:", data.user);

        // Si quieres cerrar el formulario y mostrar la app:
        document.getElementById("authOverlay").style.display = "none";
        document.getElementById("mainApp").style.display = "block";
      } catch (err) {
        mostrarError(err.message);
      }
    });
  }

  function mostrarError(msg) {
    authError.textContent = msg;
    authError.classList.remove("d-none");
  }
});

// ---------- util ----------
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]; });
}