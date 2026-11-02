import * as assert from 'assert';
import * as vscode from 'vscode';
import { validarCPF, validarCNPJ } from '../validador';

suite('Regressão dos comandos do editor', function () {
    for (const [comando, validar] of [
        ['extension.gerarCPF', validarCPF],
        ['extension.gerarCNPJ', validarCNPJ],
    ] as const) {
        test(`${comando}: substituir seleções com múltiplos cursores`, async function () {
            const documento = await vscode.workspace.openTextDocument({ content: 'pessoa1\npessoa2' });
            const editor = await vscode.window.showTextDocument(documento);
            editor.selections = [
                new vscode.Selection(0, 0, 0, 7),
                new vscode.Selection(1, 0, 1, 7),
            ];
            let listener: vscode.Disposable | undefined;
            try {
                const alterado = new Promise<void>((resolve) => {
                    listener = vscode.workspace.onDidChangeTextDocument((evento) => {
                        if (evento.document === documento) {
                            resolve();
                        }
                    });
                });
                await vscode.commands.executeCommand(comando);
                await alterado;
                const documentos = documento.getText().split('\n');
                assert.strictEqual(documentos.length, 2);
                assert.ok(documentos.every((valor) => validar(valor).valido));
            } finally {
                listener?.dispose();
                await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
            }
        });
    }
});
