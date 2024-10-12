export function calcularModulo11(entrada: string, multiplicadores: number[]): string {

    let soma: number = 0;

    for (let i = entrada.length - 1, j = 0; i >= 0; i-- , j++) {
        soma += multiplicadores[j] * (entrada[i].charCodeAt(0) - 48);
    }

    const resto = soma % 11;
    const dv = resto > 1 ? String(11 - resto) : '0';

    return dv;
}
