// ═══════════════════════════════════════════════
//  EpiGuard — Lógica principal
// ═══════════════════════════════════════════════

let modoActual    = 'normal';
let frameECG      = 0;
let puntosECG     = [];
let alertaActiva  = false;
let intervaloVoz  = null;
let temporizador  = null;
let segundos      = 0;

// ── Mensajes de voz ──
const MENSAJES = {
  preictal: [
    'Atención. Se han detectado señales previas a una crisis epiléptica. Por favor busca un lugar seguro y siéntate.',
    'Alerta temprana. Aléjate de lugares peligrosos. Avisa a alguien cercano.'
  ],
  crisis: [
    'Atención a todos. El paciente está teniendo una crisis epiléptica. No lo sujeten. Pongan algo suave bajo su cabeza. Alejen objetos peligrosos.',
    'El paciente sigue en crisis. Si dura más de cinco minutos llamen a emergencias.'
  ]
};

// ════════════════════════════════════════════════
//  INICIO
// ════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  cargarHistorial();
  actualizarReloj();
  setInterval(actualizarReloj, 1000);

  // Esperar a que el canvas tenga tamaño real antes de dibujar
  setTimeout(iniciarECG, 100);
});

function actualizarReloj() {
  const el = document.getElementById('reloj');
  if (!el) return;
  const n = new Date();
  el.textContent =
    n.getHours().toString().padStart(2,'0') + ':' +
    n.getMinutes().toString().padStart(2,'0') + ':' +
    n.getSeconds().toString().padStart(2,'0');
}

// ════════════════════════════════════════════════
//  GRÁFICA ECG
// ════════════════════════════════════════════════
function iniciarECG() {
  const canvas = document.getElementById('ecg-canvas');
  if (!canvas) return;
  // Forzar tamaño explícito desde el contenedor
  canvas.width  = canvas.parentElement.clientWidth - 28;
  canvas.height = 80;
  puntosECG = [];
  dibujarECG();
}

function muestraECG(frame, modo) {
  const t = frame * 0.05;
  if (modo === 'normal') {
    const fase = t % 1.2;
    if (fase < 0.10) return Math.sin(fase / 0.10 * Math.PI) * 0.15;
    if (fase < 0.18) return Math.sin((fase - 0.10) / 0.04 * Math.PI) * 1.0;
    if (fase < 0.24) return -Math.sin((fase - 0.18) / 0.06 * Math.PI) * 0.25;
    if (fase < 0.34) return Math.sin((fase - 0.24) / 0.10 * Math.PI) * 0.4;
    return (Math.random() - 0.5) * 0.04;
  }
  if (modo === 'preictal') {
    return muestraECG(frame, 'normal') + Math.sin(t * 2.1) * 0.22 + (Math.random() - 0.5) * 0.1;
  }
  if (modo === 'crisis') {
    return Math.sin(t * 8.5) * 0.8 + (Math.random() - 0.5) * 0.35;
  }
  // cargando / electrodo: línea casi plana con ruido mínimo
  return (Math.random() - 0.5) * 0.03;
}

function dibujarECG() {
  const canvas = document.getElementById('ecg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, mid = H / 2;

  ctx.clearRect(0, 0, W, H);

  // Fondo de grilla sutil
  ctx.strokeStyle = '#e5e3db';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 20) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Color de la señal según modo
  const color = modoActual === 'crisis'   ? '#dc2626' :
                modoActual === 'preictal' ? '#d97706' :
                modoActual === 'cargando' || modoActual === 'electrodo' ? '#9ca3af' :
                '#16a34a';

  puntosECG.push(muestraECG(frameECG, modoActual));
  if (puntosECG.length > W) puntosECG.shift();

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1.8;
  ctx.lineJoin    = 'round';
  puntosECG.forEach((v, i) => {
    const x = i;
    const y = mid - v * (H * 0.40);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  frameECG++;
  requestAnimationFrame(dibujarECG);
}

// ════════════════════════════════════════════════
//  AUDIO — SpeechSynthesis
// ════════════════════════════════════════════════
function hablar(texto) {
  window.speechSynthesis.cancel();
  const msg    = new SpeechSynthesisUtterance(texto);
  msg.lang     = 'es-PE';
  msg.volume   = 1;
  msg.rate     = 0.88;
  msg.pitch    = 1;
  const voces  = window.speechSynthesis.getVoices();
  const vozES  = voces.find(v => v.lang.startsWith('es'));
  if (vozES) msg.voice = vozES;
  window.speechSynthesis.speak(msg);
}

function iniciarAlertaAudio(tipo) {
  if (alertaActiva) return;
  alertaActiva = true;
  let turno = 0;
  const msgs = MENSAJES[tipo] || [];
  hablar(msgs[0]);
  turno = 1;
  intervaloVoz = setInterval(() => {
    if (!alertaActiva) { clearInterval(intervaloVoz); return; }
    hablar(msgs[turno % msgs.length]);
    turno++;
  }, 30000);
}

function detenerAlertaAudio() {
  alertaActiva = false;
  clearInterval(intervaloVoz);
  intervaloVoz = null;
  window.speechSynthesis.cancel();
}

function probarAudio(tipo) {
  hablar(MENSAJES[tipo][0]);
}

// ════════════════════════════════════════════════
//  TEMPORIZADOR DE CRISIS
// ════════════════════════════════════════════════
function iniciarTemporizador() {
  segundos = 0;
  clearInterval(temporizador);
  const el = document.getElementById('timer-crisis');
  if (el) { el.style.display = 'block'; el.style.color = '#1a1a18'; }

  temporizador = setInterval(() => {
    segundos++;
    const el = document.getElementById('timer-crisis');
    if (el) {
      const m = Math.floor(segundos / 60).toString().padStart(2,'0');
      const s = (segundos % 60).toString().padStart(2,'0');
      el.textContent = m + ':' + s;
      if (segundos >= 240) el.style.color = '#dc2626';
      else if (segundos >= 120) el.style.color = '#d97706';
    }
    if (segundos === 240) hablar('Han pasado cuatro minutos. La crisis continúa. Llamen a emergencias ahora.');
    if (segundos === 300) { hablar('Cinco minutos en crisis. Emergencia médica. Llamen al ciento dieciséis.'); clearInterval(temporizador); }
  }, 1000);
}

function detenerCrisis() {
  clearInterval(temporizador);
  detenerAlertaAudio();
  const el = document.getElementById('timer-crisis');
  if (el) el.style.display = 'none';
  // Volver a normal
  document.getElementById('sim-select').value = 'normal';
  simularEstado('normal');
  mostrarPantalla('dashboard');
}

// ════════════════════════════════════════════════
//  NAVEGACIÓN
// ════════════════════════════════════════════════
function mostrarPantalla(nombre) {
  document.querySelectorAll('.pantalla').forEach(p => p.classList.add('oculto'));
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  document.getElementById('pantalla-' + nombre).classList.remove('oculto');
  document.querySelectorAll('.pill').forEach(b => {
    if (b.getAttribute('data-pantalla') === nombre) b.classList.add('active');
  });
}

// ════════════════════════════════════════════════
//  SIMULADOR — actualiza TODA la UI
// ════════════════════════════════════════════════
function simularEstado(modo) {
  modoActual = modo;
  detenerAlertaAudio();
  clearInterval(temporizador);

  // Referencias a todos los elementos
  const banner   = document.getElementById('status-banner');
  const icon     = document.getElementById('status-icon');
  const titulo   = document.getElementById('status-title');
  const sub      = document.getElementById('status-sub');
  const timerEl  = document.getElementById('timer-crisis');

  // Reset clases banner y timer
  banner.className = 'status-banner';
  if (timerEl) timerEl.style.display = 'none';

  // Reset electrodos
  ['dot-ra','dot-la','dot-rl'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.className = 'dot ok';
  });

  if (modo === 'normal') {
    icon.textContent  = '✓';
    titulo.textContent = 'Todo normal';
    sub.textContent   = 'Sin actividad epiléptica detectada · Clase A';
    setM('m-hr',  '72 <span class="unidad">bpm</span>', 'ok');
    setM('m-ecg', 'Estable',  'ok');
    setM('m-imu', 'Bajo',     'ok');
    setM('m-ml',  'Clase A',  'ok');
    setB('ecg-badge',  'Estable',       'ok');
    setB('elec-badge', '3/3 correctos', 'ok');
    setBatt(78, '~6h restantes', 'high');
  }

  else if (modo === 'preictal') {
    banner.classList.add('advertencia');
    icon.textContent  = '⚠';
    titulo.textContent = 'Alerta pre-ictal — busca un lugar seguro';
    sub.textContent   = 'Señales cardíacas anómalas detectadas';
    setM('m-hr',  '98 <span class="unidad">bpm</span>', 'advertencia');
    setM('m-ecg', 'Anómala',   'advertencia');
    setM('m-imu', 'Medio',     'advertencia');
    setM('m-ml',  'Pre-ictal', 'advertencia');
    setB('ecg-badge',  'Anómala',       'advertencia');
    setB('elec-badge', '3/3 correctos', 'ok');
    setBatt(78, '~6h restantes', 'high');
    guardarEnHistorial('preictal');
    iniciarAlertaAudio('preictal');
  }

  else if (modo === 'crisis') {
    banner.classList.add('alerta');
    icon.textContent  = '🚨';
    titulo.textContent = 'Crisis epiléptica en curso';
    sub.textContent   = 'Clase B · SMS enviado · Temporizador activo';
    setM('m-hr',  '134 <span class="unidad">bpm</span>', 'peligro');
    setM('m-ecg', 'Crisis',  'peligro');
    setM('m-imu', 'Alto',    'peligro');
    setM('m-ml',  'Clase B', 'peligro');
    setB('ecg-badge',  'Crisis',         'peligro');
    setB('elec-badge', '3/3 correctos',  'ok');
    setBatt(78, 'Uso normal', 'high');
    guardarEnHistorial('crisis');
    iniciarAlertaAudio('crisis');
    iniciarTemporizador();
    mostrarPantalla('alertas');
  }

  else if (modo === 'cargando') {
    icon.textContent  = '🔌';
    titulo.textContent = 'Dispositivo cargando';
    sub.textContent   = 'Monitoreo pausado · señal OFF';
    setM('m-hr',  '--',      'gris');
    setM('m-ecg', 'Pausada', 'gris');
    setM('m-imu', '--',      'gris');
    setM('m-ml',  'OFF',     'gris');
    setB('ecg-badge',  'Pausada', 'gris');
    setB('elec-badge', '--',      'gris');
    setBatt(42, 'Cargando · ~1h 20min para completar', 'mid');
  }

  else if (modo === 'electrodo') {
    icon.textContent  = '⚡';
    titulo.textContent = 'Electrodo mal colocado';
    sub.textContent   = 'RL (cintura) sin señal — revisa el arnés';
    setM('m-hr',  '--',    'peligro');
    setM('m-ecg', 'Error', 'peligro');
    setM('m-imu', '--',    'gris');
    setM('m-ml',  'Error', 'peligro');
    setB('ecg-badge',  'Sin señal',     'peligro');
    setB('elec-badge', '2/3 correctos', 'peligro');
    setBatt(78, 'Uso normal', 'high');
    const dotRL = document.getElementById('dot-rl');
    if (dotRL) dotRL.className = 'dot error';
  }
}

// ── Helpers UI ──
function setM(id, html, clase) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML  = html;
  el.className  = 'metrica-valor ' + clase;
}
function setB(id, texto, clase) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = texto;
  el.className   = 'badge ' + clase;
}
function setBatt(pct, texto, nivel) {
  const bar = document.getElementById('batt-bar');
  const pctEl = document.getElementById('batt-pct');
  const stEl  = document.getElementById('batt-status');
  if (bar)   { bar.style.width = pct + '%'; bar.className = 'batt-bar ' + nivel; }
  if (pctEl) pctEl.textContent = pct + '%';
  if (stEl)  stEl.textContent  = texto;
}

// ════════════════════════════════════════════════
//  HISTORIAL — localStorage
// ════════════════════════════════════════════════
function guardarEnHistorial(tipo) {
  const h = JSON.parse(localStorage.getItem('epiGuard_historial') || '[]');
  h.unshift({ tipo, fecha: new Date().toLocaleString('es-PE') });
  if (h.length > 50) h.pop();
  localStorage.setItem('epiGuard_historial', JSON.stringify(h));
  cargarHistorial();
}

function cargarHistorial() {
  const lista = document.getElementById('lista-historial');
  if (!lista) return;
  const h = JSON.parse(localStorage.getItem('epiGuard_historial') || '[]');
  if (h.length === 0) {
    lista.innerHTML = '<div class="hist-vacio">Sin eventos registrados aún</div>';
    return;
  }
  lista.innerHTML = h.map(ev => `
    <div class="hist-item">
      <span class="hist-dot ${ev.tipo}"></span>
      <div class="hist-info">
        <div class="hist-tipo">${ev.tipo === 'crisis' ? '🔴 Crisis tónico-clónica' : '🟡 Alerta pre-ictal'}</div>
        <div class="hist-fecha">${ev.fecha}</div>
      </div>
    </div>
  `).join('');
}

function limpiarHistorial() {
  if (confirm('¿Borrar todo el historial?')) {
    localStorage.removeItem('epiGuard_historial');
    cargarHistorial();
  }
}

// ════════════════════════════════════════════════
//  ALERTAS — GPS y llamada
// ════════════════════════════════════════════════
function obtenerUbicacion() {
  const el = document.getElementById('ubicacion-info');
  if (!el) return;
  el.textContent = 'Obteniendo ubicación...';
  if (!navigator.geolocation) { el.textContent = 'GPS no disponible'; return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(5);
      const lon = pos.coords.longitude.toFixed(5);
      el.textContent = `Lat: ${lat} · Lon: ${lon}`;
      localStorage.setItem('epiGuard_ubicacion', `${lat},${lon}`);
    },
    () => { el.textContent = 'No se pudo obtener la ubicación'; }
  );
}

function llamarEmergencia() {
  const tel = document.getElementById('contacto-tel').textContent.replace(/\s/g,'');
  window.location.href = 'tel:' + tel;
}
// ════════════════════════════════════════════════
//  CONEXIÓN REAL AL BACKEND
// ════════════════════════════════════════════════

const urlservidor = 'http://localhost:8080'; 
let intervalobackend = null;

async function consultarbackend() {
  try {
    const peticion = await fetch(urlservidor + '/estado');
    const datosjson = await peticion.json();
    
    if (datosjson.estado) {
      let estadoactual = datosjson.estado.toLowerCase();
      
      if (estadoactual === 'alerta') {
        estadoactual = 'preictal';
      }
      
      if (estadoactual !== modoActual) {
        simularEstado(estadoactual); 
      }
    }
  } catch (errorconexion) {
    console.error('Buscando servidor...', errorconexion);
  }
}

function iniciarconexionreal() {
  intervalobackend = setInterval(consultarbackend, 3000);
}

// Arranca la conexión apenas carga la página
iniciarconexionreal();