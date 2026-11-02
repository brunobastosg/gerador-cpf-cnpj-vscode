import * as assert from 'assert';
import { validarCPF, validarCNPJ } from '../validador';

suite('Testes dos validadores', function () {
    for (const cpf of ['00000000272', '000.000.002-72', '52998224725', '529.982.247-25']) {
        test(`Validar CPF ${cpf}`, function () {
            assert.deepStrictEqual(validarCPF(cpf), { valido: true });
        });
    }

    for (const cnpj of ['00000000000191', '00.000.000/0001-91', '11222333000181', '11.222.333/0001-81', '12ABC34501DE35', '12.ABC.345/01DE-35']) {
        test(`Validar CNPJ ${cnpj}`, function () {
            assert.deepStrictEqual(validarCNPJ(cnpj), { valido: true });
        });
    }

    for (const cpf of [
        '', '0000000027', '000000002722', '000.000002-72', '000-000-002.72',
        '0000000027A', ' 00000000272', '00000000272\n', 'texto00000000272',
        '00000000273', '00000000282', '000.000.002-73', '00000000000', '111.111.111-11',
    ]) {
        test(`Rejeitar CPF ${JSON.stringify(cpf)}`, function () {
            const resultado = validarCPF(cpf);
            assert.strictEqual(resultado.valido, false);
            if (!resultado.valido) {
                assert.ok(resultado.motivo.length > 0);
            }
        });
    }

    for (const cnpj of [
        '', '0000000000019', '000000000001911', '00.000000/0001-91', '00-000-000/0001.91',
        '12abc34501de35', '12.ABC.345/01DE-3A', '12ABC34501DE3A', '12ABC34501D_35',
        ' 00000000000191', '00000000000191\n', 'texto00000000000191',
        '00000000000192', '00000000000181', '12ABC34501DE36', '12ABC34501DE45',
        '12.ABC.345/01DE-36', '00000000000000', '11.111.111/1111-11',
    ]) {
        test(`Rejeitar CNPJ ${JSON.stringify(cnpj)}`, function () {
            const resultado = validarCNPJ(cnpj);
            assert.strictEqual(resultado.valido, false);
            if (!resultado.valido) {
                assert.ok(resultado.motivo.length > 0);
            }
        });
    }
});
