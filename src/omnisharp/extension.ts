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
import reportDiagnostics, { Advisor } from '../features/diagnosticsProvider';
import CodeActionProvider from '../features/codeActionProvider';
import CodeLensProvider from '../features/codeLensProvider';
import CompletionItemProvider from '../features/completionItemProvider';
import DefinitionMetadataDocumentProvider from '../features/definitionMetadataDocumentProvider';
import DefinitionProvider from '../features/definitionProvider';
import DocumentHighlightProvider from '../features/documentHighlightProvider';
import DocumentSymbolProvider from '../features/documentSymbolProvider';
import FormatProvider from '../features/formattingEditProvider';
import HoverProvider from '../features/hoverProvider';
import ImplementationProvider from '../features/implementationProvider';
import { OmniSharpServer } from './server';
import ReferenceProvider from '../features/referenceProvider';
import RenameProvider from '../features/renameProvider';
import SignatureHelpProvider from '../features/signatureHelpProvider';
import WorkspaceSymbolProvider from '../features/workspaceSymbolProvider';
import forwardChanges from '../features/changeForwarding';
import registerCommands from '../features/commands';
import { EventStream } from '../EventStream';
import CompositeDisposable from '../CompositeDisposable';
import Disposable from '../Disposable';
import trackVirtualDocuments from '../features/virtualDocumentTracker';
import { StructureProvider } from '../features/structureProvider';

export interface ActivationResult {
    readonly server: OmniSharpServer;
    readonly advisor: Advisor;
}

export async function activate(context: theia.PluginContext, eventStream: EventStream, extensionPath: string) {
    const documentSelector: theia.DocumentSelector = {
        language: 'csharp',
    };

    const server = new OmniSharpServer(eventStream, extensionPath);
    const advisor = new Advisor(server);
    const disposables = new CompositeDisposable();
    let localDisposables: CompositeDisposable | undefined;

    disposables.add(server.onServerStart(() => {
        localDisposables = new CompositeDisposable();
        const definitionMetadataDocumentProvider = new DefinitionMetadataDocumentProvider();
        definitionMetadataDocumentProvider.register();
        localDisposables.add(definitionMetadataDocumentProvider);
        const definitionProvider = new DefinitionProvider(server, definitionMetadataDocumentProvider);
        localDisposables.add(theia.languages.registerDefinitionProvider(documentSelector, definitionProvider));
        localDisposables.add(theia.languages.registerDefinitionProvider({ scheme: definitionMetadataDocumentProvider.scheme }, definitionProvider));
        localDisposables.add(theia.languages.registerImplementationProvider(documentSelector, new ImplementationProvider(server)));
        localDisposables.add(theia.languages.registerCodeLensProvider(documentSelector, new CodeLensProvider(server)));
        localDisposables.add(theia.languages.registerDocumentHighlightProvider(documentSelector, new DocumentHighlightProvider(server)));
        localDisposables.add(theia.languages.registerDocumentSymbolProvider(documentSelector, new DocumentSymbolProvider(server)));
        localDisposables.add(theia.languages.registerReferenceProvider(documentSelector, new ReferenceProvider(server)));
        localDisposables.add(theia.languages.registerHoverProvider(documentSelector, new HoverProvider(server)));
        localDisposables.add(theia.languages.registerRenameProvider(documentSelector, new RenameProvider(server)));
        localDisposables.add(theia.languages.registerDocumentRangeFormattingEditProvider(documentSelector, new FormatProvider(server)));
        localDisposables.add(theia.languages.registerOnTypeFormattingEditProvider(documentSelector, new FormatProvider(server), '}', ';'));
        localDisposables.add(theia.languages.registerCompletionItemProvider(documentSelector, new CompletionItemProvider(server), '.', ' '));
        localDisposables.add(theia.languages.registerWorkspaceSymbolProvider(new WorkspaceSymbolProvider(server)));
        localDisposables.add(theia.languages.registerSignatureHelpProvider(documentSelector, new SignatureHelpProvider(server), '(', ','));
        const codeActionProvider = new CodeActionProvider(server);
        localDisposables.add(codeActionProvider);
        localDisposables.add(theia.languages.registerCodeActionsProvider(documentSelector, codeActionProvider));
        localDisposables.add(reportDiagnostics(server, advisor));
        localDisposables.add(forwardChanges(server));
        localDisposables.add(trackVirtualDocuments(server, eventStream));
        localDisposables.add(theia.languages.registerFoldingRangeProvider(documentSelector, new StructureProvider(server)));
    }));

    disposables.add(server.onServerStop(() => {
        if (localDisposables) {
            localDisposables.dispose();
        }
        localDisposables = undefined;
    }));

    disposables.add(registerCommands(server, eventStream));
    server.autoStart();

    // stop server on deactivate
    disposables.add(new Disposable(() => {
        advisor.dispose();
        server.stop();
    }));

    context.subscriptions.push(disposables);

    return new Promise<ActivationResult>(resolve =>
        server.onServerStart(() =>
            resolve({ server, advisor })));
}
