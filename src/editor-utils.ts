'use strict';

import * as vscode from 'vscode';

export function inserirOuSubstituirTexto(texto: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        console.warn('Nenhum editor ativo.');
        return;
    }

    const position = editor.selection.active;

    editor.edit(e => {
        if (editor.selection.isEmpty) {
            e.insert(position, texto);
        } else {
            e.replace(editor.selection, texto);
        }
    });

}