// src/utils/finance.js
// Reglas y cálculos compartidos por todas las pantallas.
import { formatCurrency, getMonthName } from './formatters';

// ---------- Categorías ----------

export const CATEGORIAS_GASTO = [
  'HOGAR', 'SALUD', 'COMIDA', 'ROPA', 'OCIO', 'TRANSPORTE',
  'SERVICIOS', 'EDUCACIÓN', 'REGALO/CONTRIBUCIÓN', 'IMPUESTOS/TRÁMITES',
  'INVERSIÓN', 'ING/CAMBIO', 'TRANSFERENCIA', 'OTROS'
];

export const CATEGORIAS_INGRESO = [
  'SUELDO', 'EXTRA', 'VENTA', 'REINTEGRO', 'REGALO', 'OTROS INGRESOS'
];

// Movimientos de dinero propio: no son consumo del hogar y no van a las gráficas.
export const CATEGORIAS_NO_CONSUMO = [
  'TRANSFERENCIA', 'PAGO_TARJETA', 'PAGO_DEUDA', 'AHORRO', 'AHORRO_USD', 'INVERSIÓN'
];

// Comisión por defecto al transferir desde una tarjeta de crédito a una cuenta
export const COMISION_TRANSFERENCIA_TARJETA = 7;

// Lo que cuenta como "ahorro" al calcular cuánto separan por mes.
export const CATEGORIAS_AHORRO = ['AHORRO', 'AHORRO_USD', 'INVERSIÓN'];

// "Gustos": lo primero que conviene recortar para ahorrar.
export const CATEGORIAS_GUSTOS = ['OCIO', 'ROPA', 'REGALO/CONTRIBUCIÓN'];

export const TIPOS = {
  ingreso: 'Ingreso',
  egreso: 'Gasto',
  transferencia: 'Transferencia',
  pago_tarjeta: 'Pagar Tarjeta/Deuda',
  ahorro: 'Ahorro',
};

export const OPCIONES_CUOTAS = [1, 3, 6, 9, 12, 18, 24];

// ---------- Meses ----------

// Las fechas se guardan como 'YYYY-MM-DD'. Se usa el texto directamente para
// evitar que la zona horaria mueva el día 1 al mes anterior.
export const monthKey = (fecha) => (fecha ? String(fecha).slice(0, 7) : '');

export const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const todayISO = () => {
  const d = new Date();
  return `${currentMonthKey()}-${String(d.getDate()).padStart(2, '0')}`;
};

export const addMonths = (key, n) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const monthDiff = (fromKey, toKey) => {
  const [y1, m1] = fromKey.split('-').map(Number);
  const [y2, m2] = toKey.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
};

export const monthLabel = (key) => {
  if (!key) return '';
  const [y, m] = key.split('-');
  return `${getMonthName(parseInt(m, 10))} ${y}`;
};

// ---------- Clasificación de transacciones ----------

export const esConsumo = (t) =>
  t.tipo === 'egreso' && !CATEGORIAS_NO_CONSUMO.includes(t.categoria);

export const esIngresoReal = (t) =>
  t.tipo === 'ingreso' && !['AHORRO', 'TRANSFERENCIA'].includes(t.categoria);

export const esAhorro = (t) =>
  t.tipo === 'egreso' && CATEGORIAS_AHORRO.includes(t.categoria);

// Retiro de plata del ahorro hacia una cuenta
export const esRetiroAhorro = (t) =>
  t.tipo === 'ingreso' && CATEGORIAS_AHORRO.includes(t.categoria);

export const esMovimientoAhorro = (t) => esAhorro(t) || esRetiroAhorro(t);

export const tieneCuotas = (t) => (t.cuotas || 1) > 1 && !!t.primerMesCuota;

// Número de cuota (1..N) que cae en el mes indicado, o 0 si no cae ninguna.
export const cuotaEnMes = (t, key) => {
  if (!t.primerMesCuota) return 0;
  const n = monthDiff(t.primerMesCuota, key) + 1;
  return n >= 1 && n <= (t.cuotas || 1) ? n : 0;
};

// Cuánto suma una transacción al consumo de un mes.
// Las compras en cuotas se reparten mes a mes; el resto cuenta en su fecha.
export const consumoEnMes = (t, key) => {
  if (!esConsumo(t)) return 0;
  if (tieneCuotas(t)) return cuotaEnMes(t, key) ? t.montoCuota : 0;
  return monthKey(t.fecha) === key ? t.monto : 0;
};

// ---------- Estadísticas mensuales ----------

export const monthStats = (transactions, key) => {
  let ingresos = 0;
  let gastos = 0;
  let ahorro = 0;
  let transferencias = 0;
  let pagosTarjeta = 0;
  let cuotas = 0;
  const porCategoria = {};
  const ingresosPorCategoria = {};

  transactions.forEach(t => {
    const enMes = monthKey(t.fecha) === key;

    const consumo = consumoEnMes(t, key);
    if (consumo > 0) {
      gastos += consumo;
      porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + consumo;
      if (tieneCuotas(t)) cuotas += consumo;
    }

    if (!enMes) return;

    if (esIngresoReal(t)) {
      ingresos += t.monto;
      ingresosPorCategoria[t.categoria] = (ingresosPorCategoria[t.categoria] || 0) + t.monto;
    } else if (esAhorro(t)) {
      ahorro += t.monto;
    } else if (esRetiroAhorro(t)) {
      // Lo que se saca del ahorro descuenta lo ahorrado en el mes
      ahorro -= t.monto;
    } else if (t.tipo === 'transferencia' || (t.tipo === 'egreso' && t.categoria === 'TRANSFERENCIA')) {
      transferencias += t.monto;
      // La comisión de sacar plata de la tarjeta sí es un gasto real
      const comision = Number(t.comision) || 0;
      if (comision > 0) {
        gastos += comision;
        porCategoria.COMISIONES = (porCategoria.COMISIONES || 0) + comision;
      }
    } else if (t.tipo === 'pago_tarjeta') {
      pagosTarjeta += t.monto;
    }
  });

  const ordenar = (obj) => Object.entries(obj)
    .map(([categoria, monto]) => ({ categoria, monto }))
    .sort((a, b) => b.monto - a.monto);

  return {
    ingresos,
    gastos,
    ahorro,
    transferencias,
    pagosTarjeta,
    cuotas,
    balance: ingresos - gastos - ahorro,
    porCategoria: ordenar(porCategoria),
    ingresosPorCategoria: ordenar(ingresosPorCategoria),
  };
};

// Promedio de los N meses anteriores a `key` (sin incluirlo).
export const promedioMeses = (transactions, key, n = 3) => {
  let ingresos = 0;
  let gastos = 0;
  let mesesConDatos = 0;
  const porCategoria = {};

  for (let i = 1; i <= n; i++) {
    const s = monthStats(transactions, addMonths(key, -i));
    if (s.ingresos === 0 && s.gastos === 0) continue;
    mesesConDatos++;
    ingresos += s.ingresos;
    gastos += s.gastos;
    s.porCategoria.forEach(({ categoria, monto }) => {
      porCategoria[categoria] = (porCategoria[categoria] || 0) + monto;
    });
  }

  const div = mesesConDatos || 1;
  Object.keys(porCategoria).forEach(k => { porCategoria[k] /= div; });
  return { ingresos: ingresos / div, gastos: gastos / div, porCategoria, mesesConDatos };
};

// ---------- Tarjetas de crédito ----------

// En tarjetas y deudas personales, `saldo` negativo = deuda. Una compra resta, un pago suma.
export const infoTarjeta = (account) => {
  const limite = Number(account.limite) || 0;
  const deuda = Math.max(0, -(account.saldo || 0));
  const aFavor = Math.max(0, account.saldo || 0);
  const disponible = limite > 0 ? limite - deuda + aFavor : null;
  const uso = limite > 0 ? deuda / limite : 0;
  return { limite, deuda, aFavor, disponible, uso };
};

// Compras con tarjeta (1 pago o en cuotas) que se pagan en el mes `key`.
export const cuotasDelMes = (transactions, key, tarjetaId = null) =>
  transactions
    .filter(t => t.tipo === 'egreso' && t.primerMesCuota)
    .filter(t => !tarjetaId || t.cuentaId === tarjetaId)
    .map(t => ({ ...t, numeroCuota: cuotaEnMes(t, key) }))
    .filter(t => t.numeroCuota > 0)
    .map(t => ({ ...t, montoMes: t.montoCuota || t.monto }));

// Total a pagar de tarjetas en los próximos `n` meses, desde `fromKey`.
export const proyeccionCuotas = (transactions, fromKey, n = 6, tarjetaId = null) =>
  Array.from({ length: n }, (_, i) => {
    const key = addMonths(fromKey, i);
    const items = cuotasDelMes(transactions, key, tarjetaId);
    return { key, total: items.reduce((s, t) => s + t.montoMes, 0), items };
  });

// Compras en cuotas que todavía tienen cuotas por pagar después de `key`.
export const cuotasPendientes = (transactions, key, tarjetaId = null) =>
  transactions
    .filter(t => t.tipo === 'egreso' && tieneCuotas(t))
    .filter(t => !tarjetaId || t.cuentaId === tarjetaId)
    .map(t => {
      const pagadas = Math.min(t.cuotas, Math.max(0, monthDiff(t.primerMesCuota, key) + 1));
      const restantes = t.cuotas - pagadas;
      return { ...t, pagadas, restantes, montoRestante: restantes * t.montoCuota };
    })
    .filter(t => t.restantes > 0 || cuotaEnMes(t, key) > 0);

// ---------- Recomendaciones ----------

const pct = (x) => `${Math.round(x * 100)}%`;

export const META_AHORRO = 0.2;   // 20% de los ingresos
export const TOPE_GUSTOS = 0.3;   // regla 50/30/20

export const sugerirMetaAhorro = (transactions, key = currentMonthKey()) => {
  const prom = promedioMeses(transactions, key, 3);
  const ref = prom.ingresos || monthStats(transactions, key).ingresos;
  return Math.round((ref * META_AHORRO) / 1000) * 1000;
};

// Devuelve [{ nivel: 'alerta'|'consejo'|'bien', titulo, texto, monto? }]
export const recomendaciones = (transactions, accounts, key = currentMonthKey(), savings = {}) => {
  const recs = [];
  const mes = monthStats(transactions, key);
  const prom = promedioMeses(transactions, key, 3);
  const esMesActual = key === currentMonthKey();

  // Si el mes está en curso y todavía no cargaron el sueldo, usamos el promedio.
  const ingresoRef = mes.ingresos > 0 ? mes.ingresos : prom.ingresos;

  if (ingresoRef <= 0) {
    recs.push({
      nivel: 'consejo',
      titulo: 'Cargá sus ingresos',
      texto: 'Registren el sueldo y otros ingresos como "Ingreso" para que la app pueda calcular cuánto pueden ahorrar cada mes.',
    });
  }

  // 1. Gastar más de lo que entra
  if (ingresoRef > 0 && mes.gastos > ingresoRef) {
    recs.push({
      nivel: 'alerta',
      titulo: 'Gastan más de lo que ingresa',
      texto: `En ${monthLabel(key)} los gastos (${formatCurrency(mes.gastos)}) superan los ingresos (${formatCurrency(ingresoRef)}) por ${formatCurrency(mes.gastos - ingresoRef)}.`,
    });
  }

  // 2. Meta de ahorro (la cuota del mes según la meta anual, o 20% de los ingresos)
  const metaAhorro = metaAhorroDe(savings, key);
  const planAnual = metaAhorro ? planAhorro(transactions, metaAhorro, key) : null;
  const meta = planAnual ? planAnual.cuotaMes : ingresoRef * META_AHORRO;
  if (ingresoRef > 0 && meta > 0) {
    if (mes.ahorro >= meta) {
      recs.push({
        nivel: 'bien',
        titulo: '¡Ahorro del mes cumplido!',
        texto: `Separaron ${formatCurrency(mes.ahorro)} este mes (${pct(mes.ahorro / ingresoRef)} de los ingresos). Sigan así.`,
      });
    } else {
      const falta = meta - mes.ahorro;
      recs.push({
        nivel: 'consejo',
        titulo: `Ahorro del mes: ${formatCurrency(mes.ahorro)} de ${formatCurrency(meta)}`,
        texto: `Les faltan ${formatCurrency(falta)} para llegar a la meta. ${esMesActual ? 'Conviene separarlo apenas cobran, no con lo que sobra a fin de mes.' : ''}`.trim(),
        monto: falta,
      });
    }
  }

  // 3. Gustos por encima del 30%
  const gustos = mes.porCategoria.filter(c => CATEGORIAS_GUSTOS.includes(c.categoria));
  const totalGustos = gustos.reduce((s, c) => s + c.monto, 0);
  if (ingresoRef > 0 && totalGustos / ingresoRef > TOPE_GUSTOS) {
    recs.push({
      nivel: 'alerta',
      titulo: 'Mucho gasto en gustos',
      texto: `Ocio, ropa y regalos suman ${pct(totalGustos / ingresoRef)} de los ingresos. Lo recomendable es no pasar del ${pct(TOPE_GUSTOS)}.`,
    });
  }

  // 4. Pasar parte de un gusto a ahorro
  gustos.slice(0, 2).forEach(({ categoria, monto }) => {
    if (monto <= 0 || (ingresoRef > 0 && monto / ingresoRef < 0.05)) return;
    const recorte = Math.round((monto * 0.2) / 100) * 100;
    if (recorte <= 0) return;
    recs.push({
      nivel: 'consejo',
      titulo: `Reducir ${categoria} y pasarlo a Ahorro`,
      texto: `Si bajan ${categoria} un 20% (${formatCurrency(recorte)} por mes) y lo pasan a Ahorro, en un año juntan ${formatCurrency(recorte * 12)}.`,
      monto: recorte,
    });
  });

  // 5. Categorías que subieron mucho vs el promedio
  if (prom.mesesConDatos > 0) {
    mes.porCategoria
      .map(c => ({ ...c, promedio: prom.porCategoria[c.categoria] || 0 }))
      .filter(c => c.promedio > 0 && c.monto > c.promedio * 1.3 && c.monto - c.promedio > ingresoRef * 0.03)
      .slice(0, 2)
      .forEach(c => {
        recs.push({
          nivel: 'consejo',
          titulo: `${c.categoria} subió ${pct(c.monto / c.promedio - 1)}`,
          texto: `Este mes van ${formatCurrency(c.monto)} y el promedio de los últimos meses es ${formatCurrency(c.promedio)}.`,
        });
      });
  }

  // 6. Tarjetas de crédito
  const tarjetas = accounts.filter(a => a.tipo === 'tarjeta');
  let deudaTotal = 0;
  tarjetas.forEach(card => {
    const info = infoTarjeta(card);
    deudaTotal += info.deuda;
    if (!info.limite) {
      recs.push({
        nivel: 'consejo',
        titulo: `Configurá el límite de ${card.nombre}`,
        texto: 'Con el límite cargado la app te avisa cuánto crédito te queda disponible.',
      });
    } else if (info.uso >= 0.8) {
      recs.push({
        nivel: 'alerta',
        titulo: `${card.nombre} al ${pct(info.uso)} del límite`,
        texto: `Deben ${formatCurrency(info.deuda)} y quedan ${formatCurrency(info.disponible)} disponibles. Eviten nuevas compras con esta tarjeta.`,
      });
    } else if (info.uso >= 0.5) {
      recs.push({
        nivel: 'consejo',
        titulo: `${card.nombre} usa el ${pct(info.uso)} del límite`,
        texto: 'Lo ideal es mantener el uso por debajo del 30% para no acumular deuda.',
      });
    }

    const venc = Number(card.diaVencimiento);
    if (venc && esMesActual) {
      const hoy = new Date().getDate();
      const dias = venc - hoy;
      if (dias >= 0 && dias <= 5 && info.deuda > 0) {
        recs.push({
          nivel: 'alerta',
          titulo: `Vence ${card.nombre} ${dias === 0 ? 'hoy' : `en ${dias} día${dias === 1 ? '' : 's'}`}`,
          texto: 'Paguen el total del resumen para no generar intereses.',
        });
      }
    }
  });

  // 7. Cuotas comprometidas el mes que viene
  const proximo = proyeccionCuotas(transactions, addMonths(key, 1), 1)[0];
  if (ingresoRef > 0 && proximo.total / ingresoRef > 0.25) {
    recs.push({
      nivel: 'alerta',
      titulo: 'Muchas cuotas comprometidas',
      texto: `En ${monthLabel(proximo.key)} tienen ${formatCurrency(proximo.total)} en tarjetas (${pct(proximo.total / ingresoRef)} de los ingresos). Eviten sumar compras en cuotas.`,
    });
  }

  // 8. Deuda mayor al dinero disponible
  const enCuentas = accounts.filter(a => a.tipo === 'caja').reduce((s, a) => s + (a.saldo || 0), 0);
  if (deudaTotal > 0 && deudaTotal > enCuentas) {
    recs.push({
      nivel: 'alerta',
      titulo: 'La deuda de tarjetas supera lo que tienen en cuentas',
      texto: `Deben ${formatCurrency(deudaTotal)} y tienen ${formatCurrency(enCuentas)} en cuentas. Prioricen pagar la tarjeta antes de nuevos gastos.`,
    });
  }

  if (ingresoRef > 0 && !recs.some(r => r.nivel === 'alerta')) {
    recs.push({
      nivel: 'bien',
      titulo: 'Finanzas en orden',
      texto: `Gastaron ${pct(mes.gastos / ingresoRef)} de los ingresos en ${monthLabel(key)}.`,
    });
  }

  const orden = { alerta: 0, consejo: 1, bien: 2 };
  return recs.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
};

// Plan concreto para llegar a una meta: cuánto recortar de cada gusto.
export const planDeAhorro = (transactions, meta, key = currentMonthKey()) => {
  // Por categoría se toma el mayor entre el promedio y el mes en curso
  const base = { ...promedioMeses(transactions, key, 3).porCategoria };
  monthStats(transactions, key).porCategoria.forEach(({ categoria, monto }) => {
    base[categoria] = Math.max(base[categoria] || 0, monto);
  });

  const candidatos = Object.entries(base)
    .filter(([cat]) => CATEGORIAS_GUSTOS.includes(cat) || cat === 'OTROS' || cat === 'COMIDA')
    .map(([categoria, monto]) => ({
      categoria,
      monto,
      // Se recorta más de los gustos que de la comida
      maxRecorte: monto * (CATEGORIAS_GUSTOS.includes(categoria) ? 0.3 : 0.1),
    }))
    .sort((a, b) => b.maxRecorte - a.maxRecorte);

  let restante = meta;
  const plan = [];
  candidatos.forEach(c => {
    if (restante <= 0) return;
    const recorte = Math.min(restante, Math.round(c.maxRecorte / 100) * 100);
    if (recorte <= 0) return;
    plan.push({ categoria: c.categoria, actual: c.monto, recorte });
    restante -= recorte;
  });

  return { plan, cubierto: meta - Math.max(0, restante) };
};

// ---------- Meta de ahorro (monto + mes objetivo) ----------

// Devuelve { monto, mesInicio, mesObjetivo } o null si no hay meta.
// Se cuenta lo ahorrado desde `mesInicio` hasta `mesObjetivo` inclusive.
// Compatibilidad: las metas anuales viejas (metasAnuales[año]) se leen como
// una meta de enero a diciembre de ese año.
export const metaAhorroDe = (savings = {}, key = currentMonthKey()) => {
  const m = savings.metaAhorro;
  if (m && Number(m.monto) > 0 && m.mesObjetivo) {
    return {
      monto: Number(m.monto),
      mesInicio: m.mesInicio || `${key.slice(0, 4)}-01`,
      mesObjetivo: m.mesObjetivo,
    };
  }
  const anio = key.slice(0, 4);
  const anual = Number((savings.metasAnuales || {})[anio]) || 0;
  return anual > 0 ? { monto: anual, mesInicio: `${anio}-01`, mesObjetivo: `${anio}-12` } : null;
};

// Cuánto hay que ahorrar cada mes para llegar a la meta en el mes objetivo.
// Se recalcula con lo realmente aportado (guardado − retirado) mes a mes.
export const planAhorro = (transactions, meta, key = currentMonthKey()) => {
  const { monto, mesInicio, mesObjetivo } = meta;
  const totalMeses = Math.max(1, monthDiff(mesInicio, mesObjetivo) + 1);
  const meses = Array.from({ length: totalMeses }, (_, i) => addMonths(mesInicio, i));
  const idxActual = monthDiff(mesInicio, key); // posición del mes actual en el plan
  const aportes = meses.map((k, i) => (i <= idxActual ? monthStats(transactions, k).ahorro : 0));

  const netoAntes = aportes.slice(0, Math.max(0, idxActual)).reduce((s, x) => s + x, 0);
  const dentroDelPlan = idxActual >= 0 && idxActual < totalMeses;
  const aporteMes = dentroDelPlan ? aportes[idxActual] : 0;
  const netoAnio = aportes.reduce((s, x) => s + x, 0);
  const vencida = idxActual >= totalMeses;
  const mesesRestantes = dentroDelPlan ? totalMeses - idxActual : 0;
  const mesesDespues = Math.max(0, mesesRestantes - 1);

  // Cuota de este mes: lo que falta al empezar el mes, repartido entre los meses que quedan
  const cuotaMes = dentroDelPlan ? Math.max(0, (monto - netoAntes) / mesesRestantes) : 0;
  const faltaMes = Math.max(0, cuotaMes - aporteMes);
  const faltaAnio = Math.max(0, monto - netoAnio);
  // Desde el mes que viene: lo que falta hoy, repartido entre los meses siguientes
  const cuotaSiguientes = mesesDespues > 0 ? faltaAnio / mesesDespues : 0;

  // Cuánto les sobra en promedio por mes (ingresos − gastos del hogar)
  const prom = promedioMeses(transactions, key, 3);
  const capacidad = prom.mesesConDatos > 0 ? Math.max(0, prom.ingresos - prom.gastos) : null;

  const filas = meses.map((k, i) => {
    const estado = i < idxActual ? 'pasado' : i === idxActual ? 'actual' : 'futuro';
    return {
      key: k,
      estado,
      aporte: aportes[i],
      objetivo: estado === 'actual' ? cuotaMes : estado === 'futuro' ? cuotaSiguientes : null,
    };
  });

  return {
    metaAnual: monto,
    mesInicio,
    mesObjetivo,
    vencida,
    netoAnio,
    aporteMes,
    cuotaMes,
    faltaMes,
    faltaAnio,
    cuotaSiguientes,
    mesesDespues,
    capacidad,
    progreso: monto > 0 ? Math.min(1, Math.max(0, netoAnio / monto)) : 0,
    filas,
  };
};
