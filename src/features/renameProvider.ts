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

import AbstractSupport from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import { createRequest } from '../omnisharp/typeConversion';
import { RenameProvider, WorkspaceEdit, TextDocument, Uri, CancellationToken, Position, Range } from '@theia/plugin';

export default class OmnisharpRenameProvider extends AbstractSupport implements RenameProvider {

    public async provideRenameEdits(document: TextDocument, position: Position, newName: string, token: CancellationToken): Promise<WorkspaceEdit> {

        let req = createRequest<protocol.RenameRequest>(document, position);
        req.WantsTextChanges = true;
        req.RenameTo = newName;

        try {
            let response = await serverUtils.rename(this.server, req, token);

            if (!response) {
                return undefined;
            }

            const edit = new WorkspaceEdit();
            response.Changes.forEach(change => {
                const uri = Uri.file(change.FileName);
                change.Changes.forEach(change => {
                    edit.replace(uri,
                        new Range(change.StartLine - 1, change.StartColumn - 1, change.EndLine - 1, change.EndColumn - 1),
                        change.NewText);
                });
            });

            return edit;
        }
        catch (error) {
            return undefined;
        }
    }
}
