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
import { FindImplementationsRequest } from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import { createRequest, toLocation } from '../omnisharp/typeConversion';
import { TextDocument, Position, CancellationToken, ImplementationProvider, ProviderResult, Definition } from '@theia/plugin';

export default class CSharpImplementationProvider extends AbstractSupport implements ImplementationProvider {
    public provideImplementation(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Definition> {
        const request = <FindImplementationsRequest>createRequest(document, position);

        return serverUtils.findImplementations(this.server, request, token).then(response => {
            if (!response || !response.QuickFixes) {
                return;
            }

            return response.QuickFixes.map(fix => toLocation(fix));
        }).catch();
    }
}
