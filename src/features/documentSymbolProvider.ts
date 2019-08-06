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
import * as theia from '@theia/plugin';

import Structure = protocol.V2.Structure;
import SymbolKinds = protocol.V2.SymbolKinds;
import SymbolRangeNames = protocol.V2.SymbolRangeNames;
import { toRange3 } from '../omnisharp/typeConversion';

export default class OmnisharpDocumentSymbolProvider extends AbstractSupport implements theia.DocumentSymbolProvider {

    async provideDocumentSymbols(document: theia.TextDocument, token: theia.CancellationToken): Promise<theia.DocumentSymbol[]> {
        try {
            const response = await serverUtils.codeStructure(this.server, { FileName: document.fileName }, token);

            if (response && response.Elements) {
                return createSymbols(response.Elements);
            }

            return [];
        }
        catch (error) {
            return [];
        }
    }
}

function createSymbols(elements: Structure.CodeElement[]): theia.DocumentSymbol[] {
    let results: theia.DocumentSymbol[] = [];

    elements.forEach(element => {
        let symbol = createSymbolForElement(element);
        if (element.Children) {
            symbol.children = createSymbols(element.Children);
        }

        results.push(symbol);
    });

    return results;
}

function createSymbolForElement(element: Structure.CodeElement): theia.DocumentSymbol {
    const fullRange = element.Ranges[SymbolRangeNames.Full];
    const nameRange = element.Ranges[SymbolRangeNames.Name];

    return new theia.DocumentSymbol(element.DisplayName, /*detail*/ "", toSymbolKind(element.Kind), toRange3(fullRange), toRange3(nameRange));
}

const kinds: { [kind: string]: theia.SymbolKind; } = {};

kinds[SymbolKinds.Class] = theia.SymbolKind.Class;
kinds[SymbolKinds.Delegate] = theia.SymbolKind.Class;
kinds[SymbolKinds.Enum] = theia.SymbolKind.Enum;
kinds[SymbolKinds.Interface] = theia.SymbolKind.Interface;
kinds[SymbolKinds.Struct] = theia.SymbolKind.Struct;

kinds[SymbolKinds.Constant] = theia.SymbolKind.Constant;
kinds[SymbolKinds.Destructor] = theia.SymbolKind.Method;
kinds[SymbolKinds.EnumMember] = theia.SymbolKind.EnumMember;
kinds[SymbolKinds.Event] = theia.SymbolKind.Event;
kinds[SymbolKinds.Field] = theia.SymbolKind.Field;
kinds[SymbolKinds.Indexer] = theia.SymbolKind.Property;
kinds[SymbolKinds.Method] = theia.SymbolKind.Method;
kinds[SymbolKinds.Operator] = theia.SymbolKind.Operator;
kinds[SymbolKinds.Property] = theia.SymbolKind.Property;

kinds[SymbolKinds.Namespace] = theia.SymbolKind.Namespace;
kinds[SymbolKinds.Unknown] = theia.SymbolKind.Class;

function toSymbolKind(kind: string): theia.SymbolKind {
    // Note: 'constructor' is a special property name for JavaScript objects.
    // So, we need to handle it specifically.
    if (kind === 'constructor') {
        return theia.SymbolKind.Constructor;
    }

    return kinds[kind];
}
