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
import { createRequest, toRange } from '../omnisharp/typeConversion';
import { DocumentHighlightProvider, DocumentHighlight, DocumentHighlightKind, CancellationToken, TextDocument, Position } from '@theia/plugin';

export default class OmnisharpDocumentHighlightProvider extends AbstractSupport implements DocumentHighlightProvider {

    public async provideDocumentHighlights(resource: TextDocument, position: Position, token: CancellationToken): Promise<DocumentHighlight[]> {

        let req = createRequest<protocol.FindUsagesRequest>(resource, position);
        req.OnlyThisFile = true;
        req.ExcludeDefinition = false;

        try {
            let res = await serverUtils.findUsages(this.server, req, token);

            if (res && Array.isArray(res.QuickFixes)) {
                return res.QuickFixes.map(OmnisharpDocumentHighlightProvider._asDocumentHighlight);
            }
        }
        catch (error) {
            return [];
        }
    }

    private static _asDocumentHighlight(quickFix: protocol.QuickFix): DocumentHighlight {
        return new DocumentHighlight(toRange(quickFix), DocumentHighlightKind.Read);
    }
}
