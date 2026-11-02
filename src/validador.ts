import { CPF_MULTIPLICADORES, CNPJ_MULTIPLICADORES } from './gerador';
import { calcularModulo11 } from './modulo';

export type ResultadoValidacao = { valido: true } | { valido: false; motivo: string };

export function validarCPF(cpf: string): ResultadoValidacao {
    return validar(cpf, /^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 9, CPF_MULTIPLICADORES, 'CPF');
}

export function validarCNPJ(cnpj: string): ResultadoValidacao {
    return validar(cnpj, /^[A-Z0-9]{12}\d{2}$|^[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\/[A-Z0-9]{4}-\d{2}$/, 12, CNPJ_MULTIPLICADORES, 'CNPJ');
}

function validar(entrada: string, formato: RegExp, tamanhoBase: number, multiplicadores: number[], tipo: string): ResultadoValidacao {
    if (!formato.test(entrada)) {
        return { valido: false, motivo: `${tipo} com tamanho, caracteres ou formato inválidos.` };
    }

    const documento = entrada.replace(/[./-]/g, '');
    if (/^(.)\1+$/.test(documento)) {
        return { valido: false, motivo: `${tipo} não pode ser uma sequência repetida.` };
    }

    const base = documento.substring(0, tamanhoBase);
    const dv1 = calcularModulo11(base, multiplicadores);
    const dv2 = calcularModulo11(base.concat(dv1), multiplicadores);
    if (documento.substring(tamanhoBase) !== dv1.concat(dv2)) {
        return { valido: false, motivo: `${tipo} com dígitos verificadores inválidos.` };
    }

    return { valido: true };
}
