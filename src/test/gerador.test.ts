import * as assert from 'assert';
import { gerarCPF, gerarCNPJ, CPF_MULTIPLICADORES, CNPJ_MULTIPLICADORES } from '../gerador';
import { calcularModulo11 } from '../modulo';

suite("Testes dos geradores", function () {

    test("Gerar CPF sem máscara", function() {
        const cpf = gerarCPF(true);
        const dv1 = calcularModulo11(cpf.substring(0, 9), CPF_MULTIPLICADORES);
        const dv2 = calcularModulo11(cpf.substring(0, 10), CPF_MULTIPLICADORES);

        assert.equal(cpf, cpf.substring(0, 9).concat(dv1).concat(dv2));
    });

    test("Gerar CPF com máscara", function() {
        const regexCpfMascara = /^\d{3}\.\d{3}\.\d{3}\-\d{2}$/;
        const cpf = gerarCPF(false);
        const cpfSemMascara = cpf.replace(/\.|-/g, '');
        const dv1 = calcularModulo11(cpfSemMascara.substring(0, 9), CPF_MULTIPLICADORES);
        const dv2 = calcularModulo11(cpfSemMascara.substring(0, 10), CPF_MULTIPLICADORES);

        assert.equal(regexCpfMascara.test(cpf), true);
        assert.equal(cpfSemMascara, cpfSemMascara.substring(0, 9).concat(dv1).concat(dv2));
    });

    test("Gerar CNPJ sem máscara", function() {
        const cnpj = gerarCNPJ(true);
        const dv1 = calcularModulo11(cnpj.substring(0, 12), CNPJ_MULTIPLICADORES);
        const dv2 = calcularModulo11(cnpj.substring(0, 13), CNPJ_MULTIPLICADORES);

        assert.equal(cnpj, cnpj.substring(0, 12).concat(dv1).concat(dv2));
    });

    test("Gerar CNPJ com máscara", function() {
        const regexCnpjMascara = /^\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2}$/;
        const cnpj = gerarCNPJ(false);
        const cnpjSemMascara = cnpj.replace(/\.|\/|-/g, '');
        const dv1 = calcularModulo11(cnpjSemMascara.substring(0, 12), CNPJ_MULTIPLICADORES);
        const dv2 = calcularModulo11(cnpjSemMascara.substring(0, 13), CNPJ_MULTIPLICADORES);

        assert.equal(regexCnpjMascara.test(cnpj), true);
        assert.equal(cnpjSemMascara, cnpjSemMascara.substring(0, 12).concat(dv1).concat(dv2));
    });

});