/*
 * Copyright (c) 2012-2019 Red Hat, Inc.
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as theia from '@theia/plugin';
import { OmniSharpServer } from '../omnisharp/server';
import AbstractProvider from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import { toRange2 } from '../omnisharp/typeConversion';
import * as serverUtils from '../omnisharp/utils';
import { FileModificationType } from '../omnisharp/protocol';
import CompositeDisposable from '../CompositeDisposable';

export default class CodeActionProvider extends AbstractProvider implements theia.CodeActionProvider {

    private commandId: string;

    constructor(server: OmniSharpServer) {
        super(server);
        this.commandId = 'omnisharp.runCodeAction';
        let registerCommandDisposable = theia.commands.registerCommand({ id: this.commandId }, this.runCodeAction, this);
        this.addDisposables(new CompositeDisposable(registerCommandDisposable));
    }

    public async provideCodeActions(document: theia.TextDocument, range: theia.Range, context: theia.CodeActionContext, token: theia.CancellationToken): Promise<theia.Command[]> {
        let line: number;
        let column: number;
        let selection: protocol.V2.Range;

        // VS Code will pass the range of the word at the editor caret, even if there isn't a selection.
        // To ensure that we don't suggest selection-based refactorings when there isn't a selection, we first
        // find the text editor for this document and verify that there is a selection.
        let editor = theia.window.visibleTextEditors.find(e => e.document === document);
        if (editor) {
            if (editor.selection.isEmpty) {
                // The editor does not have a selection. Use the active position of the selection (i.e. the caret).
                let active = editor.selection.active;

                line = active.line + 1;
                column = active.character + 1;
            }
            else {
                // The editor has a selection. Use it.
                let start = editor.selection.start;
                let end = editor.selection.end;

                selection = {
                    Start: { Line: start.line + 1, Column: start.character + 1 },
                    End: { Line: end.line + 1, Column: end.character + 1 }
                };
            }
        }
        else {
            // We couldn't find the editor, so just use the range we were provided.
            selection = {
                Start: { Line: range.start.line + 1, Column: range.start.character + 1 },
                End: { Line: range.end.line + 1, Column: range.end.character + 1 }
            };
        }

        let request: protocol.V2.GetCodeActionsRequest = {
            FileName: document.fileName,
            Line: line,
            Column: column,
            Selection: selection
        };

        try {
            let response = await serverUtils.getCodeActions(this.server, request, token);
            return response.CodeActions.map(codeAction => {
                let runRequest: protocol.V2.RunCodeActionRequest = {
                    FileName: document.fileName,
                    Line: line,
                    Column: column,
                    Selection: selection,
                    Identifier: codeAction.Identifier,
                    WantsTextChanges: true,
                    WantsAllCodeActionOperations: true
                };

                return {
                    title: codeAction.Name,
                    command: this.commandId,
                    arguments: [runRequest]
                };
            });
        }
        catch (error) {
            return Promise.reject(`Problem invoking 'GetCodeActions' on OmniSharp server: ${error}`);
        }
    }

    private async runCodeAction(req: protocol.V2.RunCodeActionRequest): Promise<boolean | string | {}> {

        return serverUtils.runCodeAction(this.server, req).then(response => {

            if (response && Array.isArray(response.Changes)) {

                let edit = new theia.WorkspaceEdit();

                let fileToOpen: theia.Uri = null;
                let renamedFiles: theia.Uri[] = [];

                for (let change of response.Changes) {
                    if (change.ModificationType == FileModificationType.Renamed) {
                        // The file was renamed. Omnisharp has already persisted
                        // the right changes to disk. We don't need to try to
                        // apply text changes (and will skip this file if we see an edit)
                        renamedFiles.push(theia.Uri.file(change.FileName));
                    }
                }

                for (let change of response.Changes) {
                    if (change.ModificationType == FileModificationType.Opened) {
                        // The CodeAction requested that we open a file. 
                        // Record that file name and keep processing CodeActions.
                        // If a CodeAction requests that we open multiple files 
                        // we only open the last one (what would it mean to open multiple files?)
                        fileToOpen = theia.Uri.file(change.FileName);
                    }

                    if (change.ModificationType == FileModificationType.Modified) {
                        let uri = theia.Uri.file(change.FileName);
                        if (renamedFiles.some(r => r == uri)) {
                            // This file got renamed. Omnisharp has already
                            // persisted the new file with any applicable changes.
                            continue;
                        }

                        let edits: theia.TextEdit[] = [];
                        for (let textChange of change.Changes) {
                            edits.push(theia.TextEdit.replace(toRange2(textChange), textChange.NewText));
                        }

                        edit.set(uri, edits);
                    }
                }

                let applyEditPromise = theia.workspace.applyEdit(edit);

                // Unfortunately, the textEditor.Close() API has been deprecated
                // and replaced with a command that can only close the active editor.
                // If files were renamed that weren't the active editor, their tabs will
                // be left open and marked as "deleted" by VS Code
                let next = applyEditPromise;
                if (renamedFiles.some(r => r.fsPath == theia.window.activeTextEditor.document.uri.fsPath)) {
                    next = applyEditPromise.then(_ => {
                        return theia.commands.executeCommand<boolean>("workbench.action.closeActiveEditor");
                    });
                }

                return fileToOpen != null
                    ? next.then(_ => {
                        return theia.commands.executeCommand("vscode.open", fileToOpen);
                    })
                    : next;
            }
        }, async (error) => {
            return Promise.reject(`Problem invoking 'RunCodeAction' on OmniSharp server: ${error}`);
        });
    }
}