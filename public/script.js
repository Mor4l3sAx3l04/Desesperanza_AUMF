// script.js - Lógica Frontend para la panadería

document.addEventListener('DOMContentLoaded', () => {
  cargarProductos();
  cargarGaleria();

  const form = document.getElementById('formProducto');
  form.addEventListener('submit', guardarProducto);
});

function cargarProductos() {
  fetch('/obtenerProductos')
    .then(res => res.json())
    .then(productos => {
      const tbody = document.querySelector('#tablaProductos tbody');
      tbody.innerHTML = '';
      productos.forEach((prod, idx) => {
        const imgSrc = prod.imagen ? `/imagen/${prod.id_producto}` : 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png';
        tbody.innerHTML += `
          <tr>
            <td>${idx + 1}</td>
            <td><img src="${imgSrc}" alt="pan" class="img-thumbnail" style="width:60px;height:60px;object-fit:cover;"></td>
            <td>${prod.nombre}</td>
            <td>${prod.descripcion || ''}</td>
            <td>$${Number(prod.precio).toFixed(2)}</td>
            <td>${prod.stock}</td>
            <td>
              <button class="btn btn-sm btn-warning me-1 btn-editar" data-prod='${JSON.stringify(prod).replace(/'/g, "&#39;")}' type="button">Editar</button>
              <button class="btn btn-sm btn-danger" onclick="borrarProducto(${prod.id_producto})">Borrar</button>
            </td>
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

  // Validación JS
  const etiquetaRegex = /<[^>]*>|<\?php.*?\?>/i;
  const numeroRegex = /\d/;
  if (!nombre || !precio || !stock || precio <= 0 || stock < 0) {
    mensajeError.textContent = 'Todos los campos obligatorios deben ser válidos.';
    mensajeError.classList.remove('d-none');
    return;
  }
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

  fetch(url, {
    method: 'POST',
    body: formData
  })
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
  try {
    prod = JSON.parse(prodStr);
  } catch {
    prod = JSON.parse(decodeURIComponent(prodStr));
  }
  document.getElementById('id_producto').value = prod.id_producto;
  document.getElementById('nombre').value = prod.nombre;
  document.getElementById('descripcion').value = prod.descripcion || '';
  document.getElementById('precio').value = prod.precio;
  document.getElementById('stock').value = prod.stock;
  // Limpiar input file
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
  })
    .then(res => res.json())
    .then(resp => {
      if (resp.error) {
        alert(resp.error);
      } else {
        cargarProductos();
      }
    });
}

function cargarGaleria() {
  // Panes de temporada con descripción y precio
  const panes = [
    {
      nombre: 'Pan de Muerto',
      descripcion: 'Tradicional pan mexicano decorado con "huesitos" de masa y azúcar.',
      precio: 25,
      img: 'https://www.aceitesdeolivadeespana.com/wp-content/uploads/2016/06/pan_de_muerto.jpg'
    },
    {
      nombre: 'Calaverita de Azúcar',
      descripcion: 'Dulce típico de Día de Muertos hecho de azúcar y decorado a mano.',
      precio: 15,
      img: 'https://laroussecocina.mx/wp-content/uploads/2018/01/Calavera-de-azucar-001-Larousse-Cocina.jpg.webp'
    },
    {
      nombre: 'Pan de Calabaza',
      descripcion: 'Pan suave y esponjoso hecho con puré de calabaza y especias.',
      precio: 30,
      img: 'https://www.cuerpomente.com/medio/2023/10/16/pan-calabaza_a1d50000_231016124817_1280x720.jpg'
    },
    {
      nombre: 'Pan Fantasma',
      descripcion: 'Pan decorado con forma de fantasma, ideal para Halloween.',
      precio: 18,
      img: 'https://www.amr.org.mx/paneles/images/1/1-2-20231007191426-1.jpg'
    }
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

// Limpiar modal al cerrar
const modalEl = document.getElementById('modalProducto');
if (modalEl) {
  modalEl.addEventListener('hidden.bs.modal', () => {
    document.getElementById('formProducto').reset();
    document.getElementById('id_producto').value = '';
    document.getElementById('mensajeError').classList.add('d-none');
  });
}
