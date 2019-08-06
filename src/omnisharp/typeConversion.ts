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

import * as protocol from './protocol';
import * as theia from '@theia/plugin';

export function toLocation(location: protocol.ResourceLocation | protocol.QuickFix): theia.Location {
    const fileName = theia.Uri.file(location.FileName);
    return toLocationFromUri(fileName, location);
}

export function toLocationFromUri(uri: theia.Uri, location: protocol.ResourceLocation | protocol.QuickFix): theia.Location {
    const position = new theia.Position(location.Line - 1, location.Column - 1);

    const endLine = (<protocol.QuickFix>location).EndLine;
    const endColumn = (<protocol.QuickFix>location).EndColumn;

    if (endLine !== undefined && endColumn !== undefined) {
        const endPosition = new theia.Position(endLine - 1, endColumn - 1);
        return new theia.Location(uri, new theia.Range(position, endPosition));
    }

    return new theia.Location(uri, position);
}

export function toRange(rangeLike: { Line: number; Column: number; EndLine: number; EndColumn: number; }): theia.Range {
    let { Line, Column, EndLine, EndColumn } = rangeLike;
    return toVSCodeRange(Line, Column, EndLine, EndColumn);
}

export function toRange2(rangeLike: { StartLine: number; StartColumn: number; EndLine: number; EndColumn: number; }): theia.Range {
    let { StartLine, StartColumn, EndLine, EndColumn } = rangeLike;
    return toVSCodeRange(StartLine, StartColumn, EndLine, EndColumn);
}

export function toRange3(range: protocol.V2.Range): theia.Range {
    return toVSCodeRange(range.Start.Line, range.Start.Column, range.End.Line, range.End.Column);
}

export function toVSCodeRange(StartLine: number, StartColumn: number, EndLine: number, EndColumn: number): theia.Range {
    return new theia.Range(StartLine - 1, StartColumn - 1, EndLine - 1, EndColumn - 1);
}

export function createRequest<T extends protocol.Request>(document: theia.TextDocument, where: theia.Position | theia.Range, includeBuffer: boolean = false): T {

    let Line: number | undefined, Column: number | undefined;

    if (where instanceof theia.Position) {
        Line = where.line + 1;
        Column = where.character + 1;
    } else if (where instanceof theia.Range) {
        Line = where.start.line + 1;
        Column = where.start.character + 1;
    }

    let fileName = document.uri.scheme === "omnisharp-metadata" ?
        `${document.uri.authority}${document.fileName.replace("[metadata] ", "")}` :
        document.fileName;

    let request: protocol.Request = {
        FileName: fileName,
        Buffer: includeBuffer ? document.getText() : undefined,
        Line,
        Column
    };

    return <T>request;
}
