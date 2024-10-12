import { calcularModulo11 } from './modulo';
import { formatarCPF, formatarCNPJ } from './formatador';

export const CPF_MULTIPLICADORES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
export const CNPJ_MULTIPLICADORES = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5, 6];

export function gerarCPF(somenteNumeros: boolean | undefined): string {
    let cpf = gerar(9, CPF_MULTIPLICADORES);
    if (!somenteNumeros) {
        cpf = formatarCPF(cpf);
    }
    return cpf;
}

export function gerarCNPJ(somenteNumeros: boolean | undefined, habilitarCnpjAlfanumerico?: boolean): string {
    let cnpj = gerar(12, CNPJ_MULTIPLICADORES, habilitarCnpjAlfanumerico);
    if (!somenteNumeros) {
        cnpj = formatarCNPJ(cnpj);
    }
    return cnpj;
}

function gerar(tamanho: number, multiplicadores: number[], incluirCaracteres?: boolean): string {
    const base = gerarDigitos(tamanho, incluirCaracteres);
    const dv1 = calcularModulo11(base, multiplicadores);
    const dv2 = calcularModulo11(base.concat(dv1), multiplicadores);

    return base.concat(dv1).concat(dv2);
}

function gerarDigitos(tamanho: number, incluirCaracteres?: boolean): string {
    let s = '';
    const digitos = '0123456789';
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digitosLetras = digitos + letras;

    for (let i = 0; i < tamanho; i++) {
        if (incluirCaracteres) {
            s += digitosLetras[Math.floor(Math.random() * digitosLetras.length)];
        } else {
            s += digitos[Math.floor(Math.random() * digitos.length)];
        }
    }
    return s;
}
