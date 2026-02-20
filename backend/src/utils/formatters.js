/**
 * Convierte micros (Google Ads) a euros
 * @param {number|string} micros
 * @returns {number}
 */
export const convertMicrosToEuros = (micros) => {
    if (!micros || isNaN(micros)) return 0;
    return Number(micros) / 1_000_000;
};

/**
 * Parsea un string JSON a array, o devuelve el array si ya lo es.
 * Retorna [] en caso de error o nulo.
 * @param {string|Array} field
 * @returns {Array}
 */
export const parseJsonArray = (field) => {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    try {
        const parsed = JSON.parse(field);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
};
