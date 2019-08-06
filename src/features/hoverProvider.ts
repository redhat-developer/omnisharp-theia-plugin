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
import { HoverProvider, Hover, TextDocument, CancellationToken, Position } from '@theia/plugin';
import { GetDocumentationString } from './documentation';

export default class OmniSharpHoverProvider extends AbstractSupport implements HoverProvider {

    public async provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover> {

        let req = createRequest<protocol.TypeLookupRequest>(document, position);
        req.IncludeDocumentation = true;

        try {
            let value = await serverUtils.typeLookup(this.server, req, token);
            if (value && value.Type) {
                let documentation = GetDocumentationString(value.StructuredDocumentation);
                let contents = [{ language: 'csharp', value: value.Type }, documentation];
                return new Hover(contents);
            }
        }
        catch (error) {
            return undefined; //No hover result could be obtained
        }
    }
}