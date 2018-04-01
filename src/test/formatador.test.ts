import * as assert from 'assert';
import { formatarCPF, formatarCNPJ } from '../formatador';

suite("Testes dos formatadores", function () {

    test("Formatar CPF", function() {
        assert.equal(formatarCPF('00000000272'), '000.000.002-72');
    });

    test("Lançar exceção ao formatar CPF com número de dígitos diferente de 11", function() {
        assert.throws(
            () => {
              formatarCPF('0000000272');
            },
            Error
          );
    });

    test("Formatar CNPJ", function() {
        assert.equal(formatarCNPJ('00000000000191'), '00.000.000/0001-91');
    });

    test("Lançar exceção ao formatar CNPJ com número de dígitos diferente de 14", function() {
        assert.throws(
            () => {
              formatarCNPJ('000000000000191');
            },
            Error
          );
    });
});