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
import * as serverUtils from '../omnisharp/utils';
import { FileChangeType } from '../omnisharp/protocol';
import { IDisposable } from '../Disposable';
import CompositeDisposable from '../CompositeDisposable';

function forwardDocumentChanges(server: OmniSharpServer): IDisposable {

    return theia.workspace.onDidChangeTextDocument(event => {

        let { document } = event;
        if (document.isUntitled || document.languageId !== 'csharp' || document.uri.scheme !== 'file') {
            return;
        }

        if (!server.isRunning()) {
            return;
        }

        serverUtils.updateBuffer(server, { Buffer: document.getText(), FileName: document.fileName }).catch(err => {
            console.error(err);
            return err;
        });
    });
}

function forwardFileChanges(server: OmniSharpServer): IDisposable {

    function onFileSystemEvent(changeType: FileChangeType): (uri: theia.Uri) => void {
        return function(uri: theia.Uri) {
            if (!server.isRunning()) {
                return;
            }

            let req = { FileName: uri.fsPath, changeType };

            serverUtils.filesChanged(server, [req]).catch(err => {
                console.warn(`[o] failed to forward file change event for ${uri.fsPath}`, err);
                return err;
            });
        };
    }

    const watcher = theia.workspace.createFileSystemWatcher('**/*.*');
    let d1 = watcher.onDidCreate(onFileSystemEvent(FileChangeType.Create));
    let d2 = watcher.onDidDelete(onFileSystemEvent(FileChangeType.Delete));
    let d3 = watcher.onDidChange(onFileSystemEvent(FileChangeType.Change));

    return new CompositeDisposable(watcher, d1, d2, d3);
}

export default function forwardChanges(server: OmniSharpServer): IDisposable {

    // combine file watching and text document watching
    return new CompositeDisposable(
        forwardDocumentChanges(server),
        forwardFileChanges(server));
}
