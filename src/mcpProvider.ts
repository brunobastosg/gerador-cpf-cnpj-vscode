import * as vscode from 'vscode';
import type { ConfiguracaoMcp } from './mcp';

export class ProvedorMcp implements vscode.McpServerDefinitionProvider<vscode.McpStdioServerDefinition>, vscode.Disposable {
    private readonly alteracoes = new vscode.EventEmitter<void>();
    readonly onDidChangeMcpServerDefinitions = this.alteracoes.event;
    private readonly configuracoes: vscode.Disposable;

    constructor(private readonly extensionUri: vscode.Uri) {
        this.configuracoes = vscode.workspace.onDidChangeConfiguration((evento) => {
            if (evento.affectsConfiguration('geradorCpfCnpj.somenteNumeros') ||
                evento.affectsConfiguration('geradorCpfCnpj.habilitarCnpjAlfanumerico')) {
                this.alteracoes.fire();
            }
        });
    }

    provideMcpServerDefinitions(): vscode.McpStdioServerDefinition[] {
        const configuracao = vscode.workspace.getConfiguration('geradorCpfCnpj');
        const padroes: ConfiguracaoMcp = {
            somenteNumeros: configuracao.get<boolean>('somenteNumeros', false),
            habilitarCnpjAlfanumerico: configuracao.get<boolean>('habilitarCnpjAlfanumerico', true),
        };
        return [new vscode.McpStdioServerDefinition(
            'Gerador de CPF/CNPJ',
            process.execPath,
            [vscode.Uri.joinPath(this.extensionUri, 'dist', 'mcpServer.js').fsPath],
            {
                ELECTRON_RUN_AS_NODE: '1',
                GERADOR_CPF_CNPJ_CONFIG: JSON.stringify(padroes),
            }
        )];
    }

    dispose(): void {
        this.configuracoes.dispose();
        this.alteracoes.dispose();
    }
}
