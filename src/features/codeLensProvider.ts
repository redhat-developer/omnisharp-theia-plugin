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

import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import * as theia from '@theia/plugin';
import { toLocation } from '../omnisharp/typeConversion';
import AbstractProvider from './abstractProvider';
import { OmniSharpServer } from '../omnisharp/server';

import Structure = protocol.V2.Structure;
import SymbolKinds = protocol.V2.SymbolKinds;
import SymbolRangeNames = protocol.V2.SymbolRangeNames;

abstract class OmniSharpCodeLens extends theia.CodeLens {
    constructor(
        range: protocol.V2.Range,
        public fileName: string) {

        super(new theia.Range(
            range.Start.Line - 1, range.Start.Column - 1, range.End.Line - 1, range.End.Column - 1
        ));
    }
}

class ReferencesCodeLens extends OmniSharpCodeLens {
    constructor(
        range: protocol.V2.Range,
        fileName: string) {
        super(range, fileName);
    }
}

export default class OmniSharpCodeLensProvider extends AbstractProvider implements theia.CodeLensProvider {

    constructor(server: OmniSharpServer) {
        super(server);
    }

    async provideCodeLenses(document: theia.TextDocument, token: theia.CancellationToken): Promise<theia.CodeLens[]> {
        try {
            const response = await serverUtils.codeStructure(this.server, { FileName: document.fileName }, token);
            if (response && response.Elements) {
                return createCodeLenses(response.Elements, document.fileName);
            }
        }
        catch (error) { }

        return [];
    }

    async resolveCodeLens(codeLens: theia.CodeLens, token: theia.CancellationToken): Promise<theia.CodeLens> {
        if (codeLens instanceof ReferencesCodeLens) {
            return this.resolveReferencesCodeLens(codeLens, token);
        }
    }

    private async resolveReferencesCodeLens(codeLens: ReferencesCodeLens, token: theia.CancellationToken): Promise<theia.CodeLens> {
        const request: protocol.FindUsagesRequest = {
            FileName: codeLens.fileName,
            Line: codeLens.range.start.line + 1, // OmniSharp is 1-based
            Column: codeLens.range.start.character + 1, // OmniSharp is 1-based
            OnlyThisFile: false,
            ExcludeDefinition: true
        };

        try {
            let result = await serverUtils.findUsages(this.server, request, token);
            if (!result || !result.QuickFixes) {
                return undefined;
            }

            const quickFixes = result.QuickFixes;
            const count = quickFixes.length;

            codeLens.command = {
                title: count === 1 ? '1 reference' : `${count} references`,
                command: 'editor.action.showReferences',
                arguments: [theia.Uri.file(request.FileName), codeLens.range.start, quickFixes.map(toLocation)]
            };

            return codeLens;
        }
        catch (error) {
            return undefined;
        }
    }
}

function createCodeLenses(elements: Structure.CodeElement[], fileName: string): theia.CodeLens[] {
    let results: theia.CodeLens[] = [];

    Structure.walkCodeElements(elements, element => {
        let codeLenses = createCodeLensesForElement(element, fileName);

        results.push(...codeLenses);
    });

    return results;
}

function createCodeLensesForElement(element: Structure.CodeElement, fileName: string): theia.CodeLens[] {
    let results: theia.CodeLens[] = [];

    if (isValidElementForReferencesCodeLens(element)) {
        let range = element.Ranges[SymbolRangeNames.Name];
        if (range) {
            results.push(new ReferencesCodeLens(range, fileName));
        }
    }

    return results;
}

const filteredSymbolNames: { [name: string]: boolean } = {
    'Equals': true,
    'Finalize': true,
    'GetHashCode': true,
    'ToString': true
};

function isValidElementForReferencesCodeLens(element: Structure.CodeElement): boolean {
    if (element.Kind === SymbolKinds.Namespace) {
        return false;
    }

    if (element.Kind === SymbolKinds.Method && filteredSymbolNames[element.Name]) {
        return false;
    }

    return true;
}
