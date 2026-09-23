// src/utils/formatters.js

// Formatear moneda
export function formatCurrency(amount) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2
    }).format(amount);
}

// Formatear fecha (esta es la función que falta)
export function formatDate(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-AR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch (error) {
        console.error('Error formateando fecha:', error);
        return dateString;
    }
}

// Formatear fecha para input type="date"
export function formatDateForInput(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
    } catch (error) {
        console.error('Error formateando fecha para input:', error);
        return '';
    }
}

// Formatear número con decimales
export function formatNumber(number) {
    return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
}

// Obtener nombre del mes
export function getMonthName(monthNumber) {
    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[monthNumber - 1] || '';
}