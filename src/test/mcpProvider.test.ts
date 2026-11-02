import * as assert from 'assert';
import { spawn } from 'child_process';
import { once } from 'events';
import { tmpdir } from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { ProvedorMcp } from '../mcpProvider';
import { ConfiguracaoMcp } from '../mcp';

const extensionUri = vscode.Uri.file(path.resolve(__dirname, '../..'));

async function comConfiguracao(configuracao: ConfiguracaoMcp, executar: () => Promise<void>): Promise<void> {
    const preferencias = vscode.workspace.getConfiguration('geradorCpfCnpj');
    const originais = {
        somenteNumeros: preferencias.inspect<boolean>('somenteNumeros')?.globalValue,
        habilitarCnpjAlfanumerico: preferencias.inspect<boolean>('habilitarCnpjAlfanumerico')?.globalValue,
    };
    try {
        await preferencias.update('somenteNumeros', configuracao.somenteNumeros, vscode.ConfigurationTarget.Global);
        await preferencias.update('habilitarCnpjAlfanumerico', configuracao.habilitarCnpjAlfanumerico, vscode.ConfigurationTarget.Global);
        await executar();
    } finally {
        await preferencias.update('somenteNumeros', originais.somenteNumeros, vscode.ConfigurationTarget.Global);
        await preferencias.update('habilitarCnpjAlfanumerico', originais.habilitarCnpjAlfanumerico, vscode.ConfigurationTarget.Global);
    }
}

async function comProcesso(definicao: vscode.McpStdioServerDefinition, executar: (cliente: Client) => Promise<void>): Promise<void> {
    const transporte = new StdioClientTransport({
        command: definicao.command,
        args: definicao.args,
        env: z.record(z.string(), z.string()).parse(definicao.env),
        cwd: tmpdir(),
        stderr: 'pipe',
    });
    let erros = '';
    transporte.stderr?.on('data', (dados: Buffer) => { erros += dados.toString(); });
    const cliente = new Client({ name: 'teste-stdio', version: '1.0.0' });
    try {
        await cliente.connect(transporte);
        assert.ok(transporte.pid);
        await executar(cliente);
        assert.strictEqual(erros, '');
    } finally {
        await cliente.close();
    }
}

async function primeiroCnpj(cliente: Client): Promise<string> {
    const resposta = await cliente.callTool({ name: 'gerar_cnpj', arguments: {} });
    assert.ok(!resposta.isError, JSON.stringify(resposta.content));
    return z.object({ documentos: z.array(z.string()).length(1) }).parse(resposta.structuredContent).documentos[0];
}

suite('Integração do MCP com o VS Code', function () {
    test('Ativar a extensão sem executar seus comandos e declarar o provedor MCP', async function () {
        const extensao = vscode.extensions.getExtension('brunobastosg.gerador-cpf-cnpj');
        assert.ok(extensao);
        const manifesto = z.object({
            engines: z.object({ vscode: z.literal('^1.101.0') }),
            contributes: z.object({
                mcpServerDefinitionProviders: z.array(z.object({ id: z.string(), label: z.string() })),
            }),
        }).parse(extensao.packageJSON);
        assert.deepStrictEqual(manifesto.contributes.mcpServerDefinitionProviders, [{
            id: 'geradorCpfCnpj.mcp', label: 'Gerador de CPF/CNPJ',
        }]);
        await extensao.activate();
        assert.strictEqual(extensao.isActive, true);
    });

    test('Usar runtime do host, bundle absoluto e configurações efetivas', async function () {
        await comConfiguracao({ somenteNumeros: true, habilitarCnpjAlfanumerico: false }, async () => {
            const provedor = new ProvedorMcp(extensionUri);
            try {
                const definicoes = provedor.provideMcpServerDefinitions();
                assert.strictEqual(definicoes.length, 1);
                const [definicao] = definicoes;
                assert.strictEqual(definicao.command, process.execPath);
                assert.deepStrictEqual(definicao.args, [path.join(extensionUri.fsPath, 'dist', 'mcpServer.js')]);
                assert.ok(path.isAbsolute(definicao.args[0]));
                assert.deepStrictEqual(definicao.env, {
                    ELECTRON_RUN_AS_NODE: '1',
                    GERADOR_CPF_CNPJ_CONFIG: JSON.stringify({ somenteNumeros: true, habilitarCnpjAlfanumerico: false }),
                });
            } finally {
                provedor.dispose();
            }
        });
    });

    test('Notificar mudanças nas duas configurações e descartar listeners', async function () {
        await comConfiguracao({ somenteNumeros: true, habilitarCnpjAlfanumerico: true }, async () => {
            const provedor = new ProvedorMcp(extensionUri);
            let alteracoes = 0;
            const listener = provedor.onDidChangeMcpServerDefinitions(() => { alteracoes++; });
            const preferencias = vscode.workspace.getConfiguration('geradorCpfCnpj');
            try {
                await preferencias.update('somenteNumeros', false, vscode.ConfigurationTarget.Global);
                assert.strictEqual(alteracoes, 1);
                await preferencias.update('habilitarCnpjAlfanumerico', false, vscode.ConfigurationTarget.Global);
                assert.strictEqual(alteracoes, 2);
                provedor.dispose();
                await preferencias.update('somenteNumeros', true, vscode.ConfigurationTarget.Global);
                assert.strictEqual(alteracoes, 2);
            } finally {
                listener.dispose();
                provedor.dispose();
            }
        });
    });

    test('Processo stdio real: descobrir ferramentas, gerar lote, validar e aplicar overrides', async function () {
        await comConfiguracao({ somenteNumeros: true, habilitarCnpjAlfanumerico: true }, async () => {
            const provedor = new ProvedorMcp(extensionUri);
            try {
                await comProcesso(provedor.provideMcpServerDefinitions()[0], async (cliente) => {
                    const { tools } = await cliente.listTools();
                    assert.deepStrictEqual(tools.map(({ name }) => name), ['gerar_cpf', 'gerar_cnpj', 'validar_cpf', 'validar_cnpj']);
                    const resposta = await cliente.callTool({
                        name: 'gerar_cnpj', arguments: { quantidade: 100, somenteNumeros: false, habilitarCnpjAlfanumerico: false },
                    });
                    assert.ok(!resposta.isError);
                    const { documentos } = z.object({ documentos: z.array(z.string()).length(100) }).parse(resposta.structuredContent);
                    assert.strictEqual(new Set(documentos).size, 100);
                    assert.ok(documentos.every((documento) => /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(documento)));
                    for (const cnpj of documentos) {
                        const validacao = await cliente.callTool({ name: 'validar_cnpj', arguments: { cnpj } });
                        assert.deepStrictEqual(validacao.structuredContent, { valido: true });
                    }
                    const cpf = await cliente.callTool({ name: 'gerar_cpf', arguments: { somenteNumeros: false } });
                    const dados = z.object({ documentos: z.array(z.string()).length(1) }).parse(cpf.structuredContent);
                    assert.match(dados.documentos[0], /^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
                    const validacao = await cliente.callTool({ name: 'validar_cpf', arguments: { cpf: dados.documentos[0] } });
                    assert.deepStrictEqual(validacao.structuredContent, { valido: true });
                });
            } finally {
                provedor.dispose();
            }
        });
    });

    test('Configuração é snapshot; novo processo aplica alterações sem afetar processo já iniciado', async function () {
        await comConfiguracao({ somenteNumeros: true, habilitarCnpjAlfanumerico: false }, async () => {
            const provedor = new ProvedorMcp(extensionUri);
            try {
                await comProcesso(provedor.provideMcpServerDefinitions()[0], async (clienteAntigo) => {
                    assert.match(await primeiroCnpj(clienteAntigo), /^\d{14}$/);
                    const preferencias = vscode.workspace.getConfiguration('geradorCpfCnpj');
                    await preferencias.update('somenteNumeros', false, vscode.ConfigurationTarget.Global);
                    await preferencias.update('habilitarCnpjAlfanumerico', true, vscode.ConfigurationTarget.Global);
                    assert.match(await primeiroCnpj(clienteAntigo), /^\d{14}$/);
                    await comProcesso(provedor.provideMcpServerDefinitions()[0], async (clienteNovo) => {
                        const cnpj = await primeiroCnpj(clienteNovo);
                        assert.match(cnpj, /^[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\/[A-Z0-9]{4}-\d{2}$/);
                    });
                });
            } finally {
                provedor.dispose();
            }
        });
    });

    test('MCP funciona sem editor e não altera documento aberto', async function () {
        assert.strictEqual(vscode.window.activeTextEditor, undefined);
        const provedor = new ProvedorMcp(extensionUri);
        try {
            await comProcesso(provedor.provideMcpServerDefinitions()[0], async (cliente) => {
                await primeiroCnpj(cliente);
                const documento = await vscode.workspace.openTextDocument({ content: '{"pessoas":[{"nome":"Ana"}]}', language: 'json' });
                await vscode.window.showTextDocument(documento);
                try {
                    const texto = documento.getText();
                    await primeiroCnpj(cliente);
                    assert.strictEqual(documento.getText(), texto);
                    assert.strictEqual(documento.isDirty, true);
                } finally {
                    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
                }
            });
        } finally {
            provedor.dispose();
        }
    });

    for (const entrada of [undefined, '{', '{}', '{"somenteNumeros":"true","habilitarCnpjAlfanumerico":false}']) {
        test(`Falha explícita na inicialização com configuração ${entrada}`, async function () {
            const env: NodeJS.ProcessEnv = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
            delete env.GERADOR_CPF_CNPJ_CONFIG;
            if (entrada !== undefined) {
                env.GERADOR_CPF_CNPJ_CONFIG = entrada;
            }
            const processo = spawn(process.execPath, [path.join(extensionUri.fsPath, 'dist', 'mcpServer.js')], { env });
            let saida = '';
            let erros = '';
            processo.stdout.on('data', (dados: Buffer) => { saida += dados.toString(); });
            processo.stderr.on('data', (dados: Buffer) => { erros += dados.toString(); });
            const [codigo] = await once(processo, 'close');
            assert.strictEqual(codigo, 1);
            assert.strictEqual(saida, '');
            assert.match(erros, /Falha ao iniciar o MCP/);
        });
    }
});
