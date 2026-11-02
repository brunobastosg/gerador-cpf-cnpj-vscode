import * as assert from 'assert';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { ConfiguracaoMcp, configuracaoMcpSchema, criarServidorMcp } from '../mcp';
import { validarCPF, validarCNPJ } from '../validador';

const padroes: ConfiguracaoMcp = { somenteNumeros: true, habilitarCnpjAlfanumerico: true };

async function comCliente(configuracao: ConfiguracaoMcp, executar: (cliente: Client) => Promise<void>): Promise<void> {
    const servidor = criarServidorMcp(configuracao);
    const cliente = new Client({ name: 'teste', version: '1.0.0' });
    const [transporteCliente, transporteServidor] = InMemoryTransport.createLinkedPair();
    try {
        await servidor.connect(transporteServidor);
        await cliente.connect(transporteCliente);
        await executar(cliente);
    } finally {
        await cliente.close();
        await servidor.close();
    }
}

async function gerar(cliente: Client, ferramenta: string, argumentos: Record<string, unknown> = {}): Promise<string[]> {
    const resposta = CallToolResultSchema.parse(await cliente.callTool({ name: ferramenta, arguments: argumentos }));
    assert.ok(!resposta.isError, JSON.stringify(resposta.content));
    const dados = z.object({ documentos: z.array(z.string()) }).strict().parse(resposta.structuredContent);
    assert.deepStrictEqual(resposta.content, [{ type: 'text', text: JSON.stringify(dados) }]);
    return dados.documentos;
}

async function comAleatoriedade(aleatorio: () => number, executar: () => Promise<void>): Promise<void> {
    const original = Math.random;
    Math.random = aleatorio;
    try {
        await executar();
    } finally {
        Math.random = original;
    }
}

suite('Testes das ferramentas MCP', function () {
    test('Listar exatamente as quatro ferramentas com títulos e schemas', async function () {
        await comCliente(padroes, async (cliente) => {
            const { tools } = await cliente.listTools();
            assert.deepStrictEqual(tools.map(({ name, title }) => [name, title]), [
                ['gerar_cpf', 'Gerar CPF'], ['gerar_cnpj', 'Gerar CNPJ'],
                ['validar_cpf', 'Validar CPF'], ['validar_cnpj', 'Validar CNPJ'],
            ]);
            for (const ferramenta of tools) {
                assert.strictEqual(ferramenta.inputSchema.type, 'object');
                assert.strictEqual(ferramenta.outputSchema?.type, 'object');
                assert.strictEqual(ferramenta.annotations?.readOnlyHint, true);
                assert.strictEqual(ferramenta.annotations?.openWorldHint, false);
                assert.strictEqual(ferramenta.annotations?.title, ferramenta.title);
            }
            assert.match(tools[0].description ?? '', /com formatação/);
            assert.match(tools[1].description ?? '', /CNPJ numérico formatado/);
        });
    });

    for (const configurado of [true, false]) {
        for (const override of [undefined, true, false]) {
            test(`CPF: configuração somenteNumeros=${configurado}, override=${override}`, async function () {
                await comCliente({ ...padroes, somenteNumeros: configurado }, async (cliente) => {
                    const documentos = await gerar(cliente, 'gerar_cpf', override === undefined ? {} : { somenteNumeros: override });
                    assert.strictEqual(documentos.length, 1);
                    assert.match(documentos[0], (override ?? configurado) ? /^\d{11}$/ : /^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
                    assert.strictEqual(validarCPF(documentos[0]).valido, true);
                });
            });
        }
    }

    for (const mascaraConfigurada of [true, false]) {
        for (const alfaConfigurado of [true, false]) {
            for (const mascaraOverride of [undefined, true, false]) {
                for (const alfaOverride of [undefined, true, false]) {
                    test(`CNPJ: configuração=${mascaraConfigurada}/${alfaConfigurado}, overrides=${mascaraOverride}/${alfaOverride}`, async function () {
                        await comAleatoriedade(() => 0.5, () => comCliente({
                            somenteNumeros: mascaraConfigurada, habilitarCnpjAlfanumerico: alfaConfigurado,
                        }, async (cliente) => {
                            const argumentos: Record<string, unknown> = {};
                            if (mascaraOverride !== undefined) {
                                argumentos.somenteNumeros = mascaraOverride;
                            }
                            if (alfaOverride !== undefined) {
                                argumentos.habilitarCnpjAlfanumerico = alfaOverride;
                            }
                            const [cnpj] = await gerar(cliente, 'gerar_cnpj', argumentos);
                            assert.strictEqual(cnpj.length, (mascaraOverride ?? mascaraConfigurada) ? 14 : 18);
                            assert.strictEqual(/[A-Z]/.test(cnpj), alfaOverride ?? alfaConfigurado);
                            assert.strictEqual(validarCNPJ(cnpj).valido, true);
                        }));
                    });
                }
            }
        }
    }

    test('Overrides são locais à chamada e não modificam a configuração', async function () {
        const configuracao = Object.freeze({ ...padroes });
        await comAleatoriedade(() => 0.5, () => comCliente(configuracao, async (cliente) => {
            const [numericoFormatado] = await gerar(cliente, 'gerar_cnpj', { somenteNumeros: false, habilitarCnpjAlfanumerico: false });
            assert.match(numericoFormatado, /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
            const [alfanumericoSemMascara] = await gerar(cliente, 'gerar_cnpj');
            assert.match(alfanumericoSemMascara, /^[A-Z0-9]{12}\d{2}$/);
            assert.match(alfanumericoSemMascara, /[A-Z]/);
            assert.deepStrictEqual(configuracao, padroes);
        }));
    });

    for (const ferramenta of ['gerar_cpf', 'gerar_cnpj']) {
        for (const somenteNumeros of [true, false]) {
            test(`${ferramenta}: lote de 100 válido e distinto, somenteNumeros=${somenteNumeros}`, async function () {
                await comCliente(padroes, async (cliente) => {
                    const documentos = await gerar(cliente, ferramenta, { quantidade: 100, somenteNumeros });
                    assert.strictEqual(documentos.length, 100);
                    assert.strictEqual(new Set(documentos).size, 100);
                    const validar = ferramenta === 'gerar_cpf' ? validarCPF : validarCNPJ;
                    assert.ok(documentos.every((documento) => validar(documento).valido));
                });
            });
        }

        for (const quantidade of [0, -1, 1.5, 101, '2', null]) {
            test(`${ferramenta}: rejeitar quantidade ${JSON.stringify(quantidade)}`, async function () {
                await comCliente(padroes, async (cliente) => {
                    const resposta = await cliente.callTool({ name: ferramenta, arguments: { quantidade } });
                    assert.strictEqual(resposta.isError, true);
                    assert.strictEqual(resposta.structuredContent, undefined);
                });
            });
        }

        test(`${ferramenta}: repetir tentativa para documento inválido e duplicado`, async function () {
            const tamanho = ferramenta === 'gerar_cpf' ? 9 : 12;
            const primeiro = [...Array<number>(tamanho - 1).fill(0.1), 0.2];
            const segundo = [...Array<number>(tamanho - 1).fill(0.2), 0.3];
            const aleatorios = [
                ...Array<number>(tamanho).fill(0),
                ...primeiro, ...primeiro, ...segundo,
            ];
            let indice = 0;
            await comAleatoriedade(() => aleatorios[indice++], () => comCliente({
                somenteNumeros: true, habilitarCnpjAlfanumerico: false,
            }, async (cliente) => {
                const documentos = await gerar(cliente, ferramenta, { quantidade: 2 });
                assert.strictEqual(documentos.length, 2);
                assert.strictEqual(new Set(documentos).size, 2);
                assert.strictEqual(indice, tamanho * 4);
            }));
        });

        for (const aleatorio of [0, 0.5]) {
            test(`${ferramenta}: esgotamento de tentativas sem sucesso parcial (${aleatorio})`, async function () {
                let tentativas = 0;
                const tamanho = ferramenta === 'gerar_cpf' ? 9 : 12;
                await comAleatoriedade(() => {
                    tentativas++;
                    return aleatorio !== 0 && tentativas % tamanho === 0 ? 0.6 : aleatorio;
                }, () => comCliente(padroes, async (cliente) => {
                    const resposta = await cliente.callTool({ name: ferramenta, arguments: { quantidade: 2 } });
                    assert.strictEqual(resposta.isError, true);
                    assert.strictEqual(resposta.structuredContent, undefined);
                    assert.ok(tentativas <= 2 * 100 * 12);
                    assert.deepStrictEqual(resposta.content, [{
                        type: 'text', text: 'Não foi possível gerar o lote completo de documentos válidos e distintos. Tente novamente.',
                    }]);
                }));
            });
        }
    }

    test('Lote de CNPJ numérico por override com configuração alfanumérica habilitada', async function () {
        await comCliente(padroes, async (cliente) => {
            const documentos = await gerar(cliente, 'gerar_cnpj', { quantidade: 100, habilitarCnpjAlfanumerico: false });
            assert.strictEqual(documentos.length, 100);
            assert.strictEqual(new Set(documentos).size, 100);
            assert.ok(documentos.every((documento) => /^\d{14}$/.test(documento) && validarCNPJ(documento).valido));
        });
    });

    for (const [ferramenta, argumentos] of [
        ['gerar_cpf', { somenteNumeros: 'false' }],
        ['gerar_cnpj', { habilitarCnpjAlfanumerico: 'false' }],
        ['validar_cpf', { cpf: 123 }],
        ['validar_cnpj', {}],
    ] as const) {
        test(`${ferramenta}: erro explícito para tipo ou argumento obrigatório inválido`, async function () {
            await comCliente(padroes, async (cliente) => {
                const resposta = await cliente.callTool({ name: ferramenta, arguments: argumentos });
                assert.strictEqual(resposta.isError, true);
            });
        });
    }

    for (const alfaConfigurado of [false, true]) {
        for (const [ferramenta, campo, documento, valido] of [
            ['validar_cpf', 'cpf', '000.000.002-72', true],
            ['validar_cpf', 'cpf', '00000000273', false],
            ['validar_cpf', 'cpf', '00000000000', false],
            ['validar_cpf', 'cpf', 'texto', false],
            ['validar_cnpj', 'cnpj', '00.000.000/0001-91', true],
            ['validar_cnpj', 'cnpj', '12.ABC.345/01DE-35', true],
            ['validar_cnpj', 'cnpj', '12ABC34501DE36', false],
            ['validar_cnpj', 'cnpj', '00000000000000', false],
        ] as const) {
            test(`${ferramenta}: ${documento}, configuração alfanumérica=${alfaConfigurado}`, async function () {
                await comCliente({ ...padroes, habilitarCnpjAlfanumerico: alfaConfigurado }, async (cliente) => {
                    const resposta = CallToolResultSchema.parse(await cliente.callTool({
                        name: ferramenta, arguments: { [campo]: documento },
                    }));
                    assert.ok(!resposta.isError);
                    const dados = z.object({ valido: z.boolean(), motivo: z.string().optional() }).strict().parse(resposta.structuredContent);
                    assert.strictEqual(dados.valido, valido);
                    assert.strictEqual(typeof dados.motivo, valido ? 'undefined' : 'string');
                    assert.deepStrictEqual(resposta.content, [{ type: 'text', text: JSON.stringify(dados) }]);
                });
            });
        }
    }

    test('Rejeitar configuração incompleta ou com tipos incorretos', function () {
        assert.strictEqual(configuracaoMcpSchema.safeParse({ somenteNumeros: true }).success, false);
        assert.strictEqual(configuracaoMcpSchema.safeParse({ somenteNumeros: 'false', habilitarCnpjAlfanumerico: true }).success, false);
        assert.deepStrictEqual(configuracaoMcpSchema.parse(padroes), padroes);
    });
});
