'use strict';

import { inserirOuSubstituirTexto } from './editor-utils';
import { gerarCPF, gerarCNPJ } from './gerador';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

    const somenteNumeros = vscode.workspace.getConfiguration('geradorCpfCnpj').get<boolean>('somenteNumeros');

    const gerarCPFDisposable = vscode.commands.registerCommand('extension.gerarCPF', () => {
        inserirOuSubstituirTexto(gerarCPF(somenteNumeros));
    });

    const gerarCNPJDisposable = vscode.commands.registerCommand('extension.gerarCNPJ', () => {
        inserirOuSubstituirTexto(gerarCNPJ(somenteNumeros));
    });

    context.subscriptions.push(gerarCPFDisposable, gerarCNPJDisposable);
}

export function deactivate() {
}

