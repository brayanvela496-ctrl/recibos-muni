// 1. Configuración de Supabase
 // ⚙️ CREDENCIALES CONFIGURADAS
    const SUPABASE_URL = 'https://epjwgnjaxguzlrmsvtuq.supabase.co';
    const SUPABASE_KEY = 'sb_publishable__py_2VbWJSOU_1BRqQdR7w_Yp4uZ5-p';
    const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables Globales
let contribuyentes = [];

// Elementos del DOM
const form = document.getElementById('form-contribuyente');
const editIdInput = document.getElementById('edit-id');
const suministroInput = document.getElementById('suministro');
const nombreInput = document.getElementById('nombre');
const direccionInput = document.getElementById('direccion');

const chkAgua = document.getElementById('chk-agua');
const chkDesague = document.getElementById('chk-desague');
const chkLimpieza = document.getElementById('chk-limpieza');

const costoAgua = document.getElementById('costo-agua');
const costoDesague = document.getElementById('costo-desague');
const costoLimpieza = document.getElementById('costo-limpieza');

const totalCalculado = document.getElementById('total-calculado');
const tablaBody = document.getElementById('tabla-body');
const filtroDeuda = document.getElementById('filtro-deuda');
const btnLimpiar = document.getElementById('btn-limpiar');

// --- EVENTOS INICIALES ---
document.addEventListener('DOMContentLoaded', () => {
  cargarContribuyentes();
  
  // Recalcular total al modificar servicios
  [chkAgua, chkDesague, chkLimpieza, costoAgua, costoDesague, costoLimpieza].forEach(el => {
    el.addEventListener('change', calcularTarifaTotal);
    el.addEventListener('input', calcularTarifaTotal);
  });

  filtroDeuda.addEventListener('change', renderTabla);
  btnLimpiar.addEventListener('click', limpiarFormulario);
  form.addEventListener('submit', guardarContribuyente);
});

// --- OBTENER DATOS DE SUPABASE (SIN LÍMITE DE 200) ---
async function cargarContribuyentes() {
  tablaBody.innerHTML = `<tr><td colspan="6" class="text-center">Cargando contribuyentes desde Supabase...</td></tr>`;

  try {
    // AQUÍ CORREGIMOS EL LÍMITE PIDIENDO HASTA 1000 REGISTROS
    const { data, error } = await _supabase
      .from('contribuyentes')
      .select('*')
      .range(0, 999)
      .order('id', { ascending: true });

    if (error) throw error;

    contribuyentes = data || [];
    renderTabla();
  } catch (error) {
    console.error('Error al obtener datos:', error);
    tablaBody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:red;">Error al cargar datos de Supabase. Verifique consola.</td></tr>`;
  }
}

// --- CALCULAR TARIFA MENSUAL ---
function calcularTarifaTotal() {
  let total = 0;
  if (chkAgua.checked) total += parseFloat(costoAgua.value || 0);
  if (chkDesague.checked) total += parseFloat(costoDesague.value || 0);
  if (chkLimpieza.checked) total += parseFloat(costoLimpieza.value || 0);

  totalCalculado.textContent = `S/. ${total.toFixed(2)}`;
  return total;
}

// --- RENDERIZAR TABLA ---
function renderTabla() {
  const filtro = filtroDeuda.value;
  tablaBody.innerHTML = '';

  const filtrados = contribuyentes.filter(item => {
    const mesesDeuda = calcularMesesDeuda(item.pagos);
    if (filtro === 'morosos') return mesesDeuda > 0;
    if (filtro === 'aldia') return mesesDeuda === 0;
    return true;
  });

  if (filtrados.length === 0) {
    tablaBody.innerHTML = `<tr><td colspan="6" class="text-center">No se encontraron registros.</td></tr>`;
    return;
  }

  filtrados.forEach(item => {
    const mesesDeuda = calcularMesesDeuda(item.pagos);
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td><strong>${item.suministro}</strong></td>
      <td>${item.nombre}</td>
      <td>${item.direccion || '-'}</td>
      <td><strong>${mesesDeuda} mes/es</strong></td>
      <td>
        ${mesesDeuda > 0 
          ? `<span class="badge-moroso">🔴 MOROSO (${mesesDeuda} Meses)</span>`
          : `<span class="badge-aldia">🟢 AL DÍA</span>`}
      </td>
      <td>
        <button class="btn-action-edit" onclick="prepararEdicion(${item.id})">Editar</button>
        <button class="btn-action-delete" onclick="eliminarContribuyente(${item.id})">Eliminar</button>
      </td>
    `;
    tablaBody.appendChild(tr);
  });
}

// Auxiliar: Contar meses con pagos en 0 (deuda)
function calcularMesesDeuda(pagos) {
  if (!pagos || typeof pagos !== 'object') return 12; // Valor por defecto
  return Object.values(pagos).filter(val => parseFloat(val) === 0).length;
}

// --- GUARDAR / ACTUALIZAR ---
async function guardarContribuyente(e) {
  e.preventDefault();

  const id = editIdInput.value;
  const servicios = {
    agua: chkAgua.checked ? parseFloat(costoAgua.value || 0) : 0,
    desague: chkDesague.checked ? parseFloat(costoDesague.value || 0) : 0,
    limpieza: chkLimpieza.checked ? parseFloat(costoLimpieza.value || 0) : 0
  };

  const payload = {
    suministro: suministroInput.value.trim(),
    nombre: nombreInput.value.trim().toUpperCase(),
    direccion: direccionInput.value.trim().toUpperCase(),
    servicios: servicios
  };

  try {
    if (id) {
      // Actualizar registro existente
      const { error } = await _supabase
        .from('contribuyentes')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
      alert('Contribuyente actualizado correctamente');
    } else {
      // Nuevo registro (crea matriz de pagos en 0 por defecto)
      payload.pagos = {
        ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 0,
        jul: 0, ago: 0, sep: 0, oct: 0, nov: 0, dic: 0
      };

      const { error } = await _supabase
        .from('contribuyentes')
        .insert([payload]);

      if (error) throw error;
      alert('Contribuyente registrado correctamente');
    }

    limpiarFormulario();
    cargarContribuyentes();
  } catch (err) {
    alert('Error al registrar/actualizar: ' + err.message);
  }
}

// --- PREPARAR EDICIÓN ---
window.prepararEdicion = function(id) {
  const item = contribuyentes.find(c => c.id === id);
  if (!item) return;

  editIdInput.value = item.id;
  suministroInput.value = item.suministro;
  nombreInput.value = item.nombre;
  direccionInput.value = item.direccion;

  if (item.servicios) {
    chkAgua.checked = item.servicios.agua > 0;
    costoAgua.value = item.servicios.agua || 10.00;

    chkDesague.checked = item.servicios.desague > 0;
    costoDesague.value = item.servicios.desague || 3.00;

    chkLimpieza.checked = item.servicios.limpieza > 0;
    costoLimpieza.value = item.servicios.limpieza || 2.00;
  }

  calcularTarifaTotal();
  btnLimpiar.style.display = 'inline-block';
  document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
};

// --- ELIMINAR ---
window.eliminarContribuyente = async function(id) {
  if (!confirm('¿Seguro que deseas eliminar este contribuyente?')) return;

  try {
    const { error } = await _supabase
      .from('contribuyentes')
      .delete()
      .eq('id', id);

    if (error) throw error;
    alert('Contribuyente eliminado');
    cargarContribuyentes();
  } catch (err) {
    alert('Error al eliminar: ' + err.message);
  }
};

// --- LIMPIAR FORMULARIO ---
function limpiarFormulario() {
  editIdInput.value = '';
  form.reset();
  chkAgua.checked = true;
  chkDesague.checked = true;
  chkLimpieza.checked = true;
  costoAgua.value = '10.00';
  costoDesague.value = '3.00';
  costoLimpieza.value = '2.00';
  calcularTarifaTotal();
  btnLimpiar.style.display = 'none';
}
// --- FUNCIÓN PARA CAMBIAR ENTRE VISTAS DEL MENÚ ---
window.cambiarVista = function(nombreVista) {
  // 1. Ocultar todas las vistas
  const vistas = document.querySelectorAll('.seccion-vista');
  vistas.forEach(v => v.style.display = 'none');

  // 2. Quitar la clase "active" de todos los botones del menú
  const itemsMenu = document.querySelectorAll('.menu-item');
  itemsMenu.forEach(item => item.classList.remove('active'));

  // 3. Mostrar la vista elegida y activar su botón
  if (nombreVista === 'padron') {
    document.getElementById('vista-padron').style.display = 'block';
    document.getElementById('btn-menu-padron').classList.add('active');
  } else if (nombreVista === 'matriz') {
    document.getElementById('vista-matriz').style.display = 'block';
    document.getElementById('btn-menu-matriz').classList.add('active');
  } else if (nombreVista === 'cortes') {
    document.getElementById('vista-cortes').style.display = 'block';
    document.getElementById('btn-menu-cortes').classList.add('active');
  }
};
