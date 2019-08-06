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
import { OmniSharpServer } from '../omnisharp/server';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import { toRange } from '../omnisharp/typeConversion';
import * as theia from '@theia/plugin';


export default class OmnisharpWorkspaceSymbolProvider extends AbstractSupport implements theia.WorkspaceSymbolProvider {

    constructor(server: OmniSharpServer) {
        super(server);
    }

    public async provideWorkspaceSymbols(search: string, token: theia.CancellationToken): Promise<theia.SymbolInformation[]> {
        let minFilterLength = 0;
        let maxItemsToReturn = 1000;

        if (minFilterLength != undefined && search.length < minFilterLength) {
            return [];
        }

        try {
            let res = await serverUtils.findSymbols(this.server, { Filter: search, MaxItemsToReturn: maxItemsToReturn, FileName: '' }, token);
            if (res && Array.isArray(res.QuickFixes)) {
                return res.QuickFixes.map(OmnisharpWorkspaceSymbolProvider._asSymbolInformation);
            }
        }
        catch (error) {
            return [];
        }
    }

    private static _asSymbolInformation(symbolInfo: protocol.SymbolLocation): theia.SymbolInformation {

        return new theia.SymbolInformation(symbolInfo.Text, OmnisharpWorkspaceSymbolProvider._toKind(symbolInfo),
            toRange(symbolInfo),
            theia.Uri.file(symbolInfo.FileName));
    }

    private static _toKind(symbolInfo: protocol.SymbolLocation): theia.SymbolKind {
        switch (symbolInfo.Kind) {
            case 'Method':
                return theia.SymbolKind.Method;
            case 'Field':
                return theia.SymbolKind.Field;
            case 'Property':
                return theia.SymbolKind.Property;
            case 'Interface':
                return theia.SymbolKind.Interface;
            case 'Enum':
                return theia.SymbolKind.Enum;
            case 'Struct':
                return theia.SymbolKind.Struct;
            case 'Event':
                return theia.SymbolKind.Event;
            case 'EnumMember':
                return theia.SymbolKind.EnumMember;
            case 'Class':
                return theia.SymbolKind.Class;
            default:
                return theia.SymbolKind.Class;

        }
    }
}
