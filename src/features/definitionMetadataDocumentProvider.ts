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

import { TextDocument, TextDocumentContentProvider, Uri, workspace } from '@theia/plugin';
import { MetadataResponse } from '../omnisharp/protocol';
import { IDisposable } from '../Disposable';

export default class DefinitionMetadataDocumentProvider implements TextDocumentContentProvider, IDisposable {
    readonly scheme = "omnisharp-metadata";
    private registration: IDisposable;
    private documents: Map<string, MetadataResponse>;
    private documentClosedSubscription: IDisposable;

    constructor() {
        this.documents = new Map<string, MetadataResponse>();
        this.documentClosedSubscription = workspace.onDidCloseTextDocument(this.onTextDocumentClosed, this);
    }

    private onTextDocumentClosed(document: TextDocument): void {
        this.documents.delete(document.uri.toString());
    }

    public dispose(): void {
        this.registration.dispose();
        this.documentClosedSubscription.dispose();
        this.documents.clear();
    }

    public addMetadataResponse(metadataResponse: MetadataResponse): Uri {
        const uri = this.createUri(metadataResponse.SourceName);
        this.documents.set(uri.toString(), metadataResponse);

        return uri;
    }

    public getExistingMetadataResponseUri(sourceName: string): Uri {
        return this.createUri(sourceName);
    }

    public register(): void {
        this.registration = workspace.registerTextDocumentContentProvider(this.scheme, this);
    }

    public provideTextDocumentContent(uri: Uri): string {
        return this.documents.get(uri.toString()).Source;
    }

    private createUri(sourceName: string): Uri {
        return Uri.parse(this.scheme + "://" +
            sourceName.replace(/\\/g, "/").replace(/(.*)\/(.*)/g, "$1/[metadata] $2"));
    }
}