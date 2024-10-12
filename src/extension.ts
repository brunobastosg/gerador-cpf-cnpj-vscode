import { gerarCPF, gerarCNPJ } from './gerador';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

    const somenteNumeros = !!vscode.workspace.getConfiguration('geradorCpfCnpj').get<boolean>('somenteNumeros');

    const gerarCPFDisposable = vscode.commands.registerCommand('extension.gerarCPF', () => {
        generate(somenteNumeros, gerarCPF);
    });

    const gerarCNPJDisposable = vscode.commands.registerCommand('extension.gerarCNPJ', () => {
        generate(somenteNumeros, gerarCNPJ);
    });

    context.subscriptions.push(gerarCPFDisposable, gerarCNPJDisposable);
}

function generate(somenteNumeros: boolean, gerador: (somenteNumeros: boolean) => string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        console.warn('Nenhum editor ativo.');
        return;
    }

    editor.edit((editBuilder) => {
        editor.selections.forEach( (element) => {
            editBuilder.replace(
                element, gerador(somenteNumeros)
            );
        });
    });

}

export function deactivate() {
}

