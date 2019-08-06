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
import { DocumentRangeFormattingEditProvider, FormattingOptions, CancellationToken, TextEdit, TextDocument, Range, Position } from '@theia/plugin';

export default class FormattingSupport extends AbstractSupport implements DocumentRangeFormattingEditProvider {

    public async provideDocumentRangeFormattingEdits(document: TextDocument, range: Range, options: FormattingOptions, token: CancellationToken): Promise<TextEdit[]> {

        let request = <protocol.FormatRangeRequest>{
            FileName: document.fileName,
            Line: range.start.line + 1,
            Column: range.start.character + 1,
            EndLine: range.end.line + 1,
            EndColumn: range.end.character + 1
        };

        try {
            let res = await serverUtils.formatRange(this.server, request, token);
            if (res && Array.isArray(res.Changes)) {
                return res.Changes.map(FormattingSupport._asEditOptionation);
            }
        }
        catch (error) {
            return [];
        }
    }

    public async provideOnTypeFormattingEdits(document: TextDocument, position: Position, ch: string, options: FormattingOptions, token: CancellationToken): Promise<TextEdit[]> {

        let request = <protocol.FormatAfterKeystrokeRequest>{
            FileName: document.fileName,
            Line: position.line + 1,
            Column: position.character + 1,
            Character: ch
        };

        try {
            let res = await serverUtils.formatAfterKeystroke(this.server, request, token);
            if (res && Array.isArray(res.Changes)) {
                return res.Changes.map(FormattingSupport._asEditOptionation);
            }
        }
        catch (error) {
            return [];
        }
    }

    private static _asEditOptionation(change: protocol.TextChange): TextEdit {
        return new TextEdit(
            new Range(change.StartLine - 1, change.StartColumn - 1, change.EndLine - 1, change.EndColumn - 1),
            change.NewText);
    }
}
