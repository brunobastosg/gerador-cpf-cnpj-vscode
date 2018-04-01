export function formatarCPF(cpf: string): string {
    if (!cpf || cpf.length !== 11) {
        throw new Error('CPF deve possuir 11 dígitos.');
    }
    return cpf
        .substring(0, 3)
        .concat('.')
        .concat(cpf.substring(3, 6))
        .concat('.')
        .concat(cpf.substring(6, 9))
        .concat('-')
        .concat(cpf.substring(9, 11));
}

export function formatarCNPJ(cnpj: string): string {
    if (!cnpj || cnpj.length !== 14) {
        throw new Error('CNPJ deve possuir 14 dígitos.');
    }
    return cnpj
        .substring(0, 2)
        .concat('.')
        .concat(cnpj.substring(2, 5))
        .concat('.')
        .concat(cnpj.substring(5, 8))
        .concat('/')
        .concat(cnpj.substring(8, 12))
        .concat('-')
        .concat(cnpj.substring(12, 14));
}