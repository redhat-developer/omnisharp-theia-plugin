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
import { createRequest, toLocation } from '../omnisharp/typeConversion';
import { ReferenceProvider, Location, TextDocument, CancellationToken, Position } from '@theia/plugin';

export default class OmnisharpReferenceProvider extends AbstractSupport implements ReferenceProvider {

    public async provideReferences(document: TextDocument, position: Position, options: { includeDeclaration: boolean; }, token: CancellationToken): Promise<Location[]> {

        let req = createRequest<protocol.FindUsagesRequest>(document, position);
        req.OnlyThisFile = false;
        req.ExcludeDefinition = true;

        try {
            let res = await serverUtils.findUsages(this.server, req, token);
            if (res && Array.isArray(res.QuickFixes)) {
                return res.QuickFixes.map(toLocation);
            }
        }
        catch (error) {
            return [];
        }
    }
}
